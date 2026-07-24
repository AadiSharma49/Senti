import { create } from 'zustand'
import { audioCapture } from '../services/audioCapture'
import { UtteranceRecorder } from '../services/utteranceRecorder'
import { loadSpeechRecognition, transcribeRaw } from '../services/speechRecognition'
import { askSenti, type ChatTurn } from '../services/assistantService'
import { getSystemSnapshot, describeSystem } from '../services/systemInfo'
import { say, deviceLang } from '../services/greetingService'
import { runAction } from '../services/actions'
import { parseWake } from '../services/wakeParse'
import { reportActivity } from '../services/statusReporter'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'
import type { Utterance } from '../types/audio'

/**
 * wakeStore — talking to Senti, hands-free.
 *
 * This is a CONVERSATION, not a command line. It has two phases:
 *
 *   dormant       — listening in the background, but staying out of your way.
 *                   It answers nothing until you engage it: say its name, say
 *                   hello, give it an order ("open Chrome"), or hit the talk
 *                   hotkey. That gate is the ONLY thing standing between you and
 *                   a machine that would otherwise answer the TV all day.
 *
 *   conversation  — once engaged, it is a real back-and-forth. EVERYTHING you
 *                   say goes to Senti and gets a spoken answer, with memory of
 *                   what came before — ask a question, count to ten, change the
 *                   subject, then tell it to do something. No wake word between
 *                   turns. It stays open for a while after each reply and drifts
 *                   back to dormant only after you've gone quiet, or when you
 *                   say "stop".
 *
 * PRIVACY: all of the listening is local. The mic feeds an on-device
 * voice-activity detector; only speech segments are transcribed by Whisper
 * running on this machine. Audio is never uploaded. Only the TEXT of what you
 * say — and only once a conversation is open — is sent to the assistant.
 */

export type WakeState =
  | 'off' // not listening at all
  | 'listening' // dormant, or between turns of a conversation
  | 'heard' // just engaged
  | 'working' // thinking / acting
  | 'speaking'

const MAX_UTTERANCE_SEC = 15
const SILENCE_FRAMES = 22
/** How long a conversation stays open after the last exchange. */
const CONVERSATION_IDLE_MS = 45_000
/** Turns of history sent for context — matches the backend's own cap. */
const HISTORY_TURNS = 12

let recorder: UtteranceRecorder | null = null
let unsubscribeLevel: (() => void) | null = null
let lastLevelAt = 0
let busy = false

/** True while a conversation is open (every utterance is for Senti). */
let inConversation = false
let idleTimer: number | null = null
/** The running back-and-forth, so replies have context. Cleared on exit. */
let history: ChatTurn[] = []

export interface WakeStore {
  state: WakeState
  /** What Senti is doing right now, shown in the HUD. */
  detail: string
  enabled: boolean
  /** True while a conversation is open — the orb shows it's actively yours. */
  talking: boolean
  /**
   * The last thing Senti transcribed, addressed to it or not. Shown in the
   * Control Center so "it can't hear me" is something you can actually see the
   * answer to — either nothing arrives (mic problem) or the words come out
   * wrong (the name was misheard). Held in memory only; never stored or sent.
   */
  lastHeard: string
  /**
   * Plain words for where listening actually is: starting up, running, or the
   * reason it isn't. Silence used to be the only symptom of a dead microphone,
   * a blocked permission or a speech model that wouldn't load — all three
   * looked identical from the outside, which made "it ignored me" impossible
   * to act on.
   */
  status: string
  /** Live microphone loudness, 0-1. Published only while the panel is open. */
  micLevel: number

  start: () => Promise<void>
  stop: () => void
  /** Open a conversation on demand — the talk hotkey and the orb use this. */
  engage: () => void
}

/**
 * A short rising two-tone chime the instant a conversation opens.
 *
 * You need an answer before Senti has finished thinking, or you're left
 * wondering whether it heard you at all. Synthesised with Web Audio so there's
 * no asset to load and no delay.
 */
function playWakeChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)

    for (const [freq, at] of [[660, 0], [990, 0.09]] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + at)
      osc.connect(gain)
      osc.start(now + at)
      osc.stop(now + at + 0.4)
    }
    window.setTimeout(() => void ctx.close().catch(() => {}), 900)
  } catch {
    // No audio device — the orb still shows.
  }
}

function setHud(visible: boolean) {
  try {
    if (visible) void window.senti?.hudShow?.()
    else void window.senti?.hudHide?.()
  } catch {
    // no bridge in a browser — fine
  }
}

/** "stop", "that's all", "never mind" — ways to end the conversation by voice. */
function isEndPhrase(textRaw: string): boolean {
  const t = textRaw.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
  const enders = [
    'stop', 'stop listening', 'thats all', 'that is all', 'nevermind', 'never mind',
    'go to sleep', 'goodbye', 'bye', 'bye senti', 'thanks thats all', 'were done',
    'we are done', 'that will be all', 'dismiss', 'shut up', 'be quiet', 'quiet',
  ]
  return enders.includes(t)
}

/** Keep the conversation open; slide the idle timeout forward. */
function keepConversationAlive(): void {
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => endConversation(false), CONVERSATION_IDLE_MS)
}

function beginConversation(): void {
  const first = !inConversation
  inConversation = true
  if (first) {
    history = []
    playWakeChime()
  }
  useWakeStore.setState({ talking: true, state: 'heard', detail: 'Listening…' })
  setHud(true)
  keepConversationAlive()
}

function endConversation(spokenOff: boolean): void {
  inConversation = false
  history = []
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  useWakeStore.setState({ talking: false, state: 'listening', detail: '' })
  setHud(false)
  if (spokenOff) void say({ text: 'Okay.', audio: null }, deviceLang())
}

export const useWakeStore = create<WakeStore>((set, get) => ({
  state: 'off',
  detail: '',
  enabled: false,
  talking: false,
  lastHeard: '',
  status: 'Not listening.',
  micLevel: 0,

  start: async () => {
    if (get().state !== 'off') return
    if (!useSettingsStore.getState().permissions.alwaysListening) return

    // Load the speech model + mic. Retry once — a cold start right after
    // unlock can lose the race for the mic, and we must not end up silently
    // not listening.
    //
    // The two are loaded separately so a failure can say WHICH one broke. They
    // used to share one catch, and "Senti is quiet" was the only symptom of
    // either.
    set({ status: 'Starting up…' })
    let started = false
    let why = ''
    for (let attempt = 0; attempt < 2 && !started; attempt++) {
      try {
        await loadSpeechRecognition()
      } catch {
        why = 'The speech model could not load, so Senti cannot understand you.'
        await new Promise((r) => setTimeout(r, 1200))
        continue
      }
      try {
        await audioCapture.start()
        started = true
      } catch {
        why = 'No microphone. Check that one is plugged in and that Windows lets Senti use it.'
        await new Promise((r) => setTimeout(r, 1200))
      }
    }
    if (!started) {
      set({ state: 'off', detail: '', status: why || 'Listening could not start.' })
      return
    }

    // Mirror the microphone level so the Control Center can show it moving.
    // Only while the panel is open: at ~20 frames a second this would
    // otherwise re-render the orb for no reason.
    unsubscribeLevel?.()
    unsubscribeLevel = audioCapture.subscribe((_frame, level) => {
      if (!useUiStore.getState().settingsOpen) return
      const now = Date.now()
      if (now - lastLevelAt < 90) return
      lastLevelAt = now
      useWakeStore.setState({ micLevel: Math.min(1, level.rms * 6) })
    })

    recorder?.stop()
    recorder = new UtteranceRecorder({
      maxUtteranceSec: MAX_UTTERANCE_SEC,
      silenceHangoverFrames: SILENCE_FRAMES,
    })
    recorder.onUtterance((u) => void onUtterance(u))
    recorder.start(audioCapture)
    set({ state: 'listening', detail: '', enabled: true, status: 'Listening.' })
  },

  stop: () => {
    unsubscribeLevel?.()
    unsubscribeLevel = null
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    inConversation = false
    history = []
    recorder?.stop()
    recorder = null
    audioCapture.stop()
    setHud(false)
    set({ state: 'off', detail: '', enabled: false, talking: false, status: 'Not listening.', micLevel: 0 })
  },

  engage: () => {
    // Hotkey / orb tap: open a conversation right now, no wake word. If Senti
    // isn't even listening (permission off), there's nothing to open.
    if (get().state === 'off') return
    beginConversation()
  },
}))

async function onUtterance(utterance: Utterance): Promise<void> {
  if (busy) return
  const store = useWakeStore.getState()
  if (store.state === 'off') return

  // Too short to be speech worth transcribing.
  if (utterance.duration < 0.4) return

  busy = true
  try {
    const heard = (await transcribeRaw(utterance)).trim()
    if (!heard) return
    useWakeStore.setState({ lastHeard: heard })

    if (inConversation) {
      // The conversation is open — anything you say is for Senti.
      if (isEndPhrase(heard)) {
        endConversation(true)
        return
      }
      keepConversationAlive()
      await handleTurn(heard)
      return
    }

    // Dormant: something has to engage Senti before it will answer.
    const { woke, command } = parseWake(heard)
    if (!woke) return // not for us — stay quiet, keep listening

    beginConversation()
    // A bare "hey Senti" opens the conversation with a quick spoken ack; a
    // "hey Senti, open Chrome" runs the command as the first turn.
    if (command) await handleTurn(command)
    else await ackEngaged()
  } catch {
    useWakeStore.setState({ state: inConversation ? 'listening' : 'listening', detail: '' })
    if (!inConversation) setHud(false)
  } finally {
    busy = false
  }
}

/** A fast, local "I'm here" when you open with just the name — no round-trip. */
async function ackEngaged(): Promise<void> {
  const acks = ['Yeah?', "I'm listening.", 'Go ahead.', "What's up?"]
  const text = acks[Math.floor(Math.random() * acks.length)]
  useWakeStore.setState({ state: 'speaking', detail: text })
  await say({ text, audio: null }, deviceLang())
  if (inConversation) useWakeStore.setState({ state: 'listening', detail: 'Listening…' })
}

/** One turn of the conversation: you said something, Senti answers (or acts). */
async function handleTurn(text: string): Promise<void> {
  setHud(true)
  useWakeStore.setState({ state: 'working', detail: text })
  // So your phone sees what you're doing, live.
  reportActivity(text, true)

  const lang = deviceLang()
  const snap = await getSystemSnapshot()
  history.push({ role: 'user', content: text })
  const reply = await askSenti(history.slice(-HISTORY_TURNS), lang, snap ? describeSystem(snap) : null)

  // The reply can be an answer, an action, or both.
  let spoken = reply.text
  if (reply.action) {
    useWakeStore.setState({ detail: 'Working…' })
    const outcome = await runAction(reply.action)
    if (outcome) spoken = outcome
  }

  history.push({ role: 'assistant', content: spoken })
  reportActivity(spoken.slice(0, 120), false)

  useWakeStore.setState({ state: 'speaking', detail: spoken })
  await say({ text: spoken, audio: spoken === reply.text ? reply.audio : null }, lang)

  // Stay in the conversation, ready for whatever you say next.
  if (inConversation) {
    keepConversationAlive()
    useWakeStore.setState({ state: 'listening', detail: 'Listening…' })
  }
}
