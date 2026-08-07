import { create } from 'zustand'
import { audioCapture } from '../services/audioCapture'
import { UtteranceRecorder } from '../services/utteranceRecorder'
import { loadSpeechRecognition, transcribeRaw } from '../services/speechRecognition'
import { askSenti, type ChatTurn } from '../services/assistantService'
import { getSystemSnapshot, describeSystem } from '../services/systemInfo'
import { say, deviceLang } from '../services/greetingService'
import { runAction } from '../services/actions'
import { parseWake, parseDismiss } from '../services/wakeParse'
import { reportActivity } from '../services/statusReporter'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'
import { useScreenContextStore } from './screenContextStore'
import type { ScreenContext } from './screenContextStore'
import type { Utterance } from '../types/audio'

// Local brain (Ollama) — imported lazily so it doesn't block startup when
// local mode is off.
let localBrainModule: typeof import('../services/localBrain') | null = null
async function getLocalBrain() {
  if (!localBrainModule) {
    localBrainModule = await import('../services/localBrain')
  }
  return localBrainModule
}

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

/**
 * Senti can be fully hidden (dismissed) while still listening. The window
 * disappears but the mic stays open — say a dismiss phrase and Senti vanishes;
 * say a wake phrase and it comes back. This is the "background buddy" mode.
 */
export type Visibility = 'visible' | 'hidden'

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
  /** The loudness Senti counts as speech, on the same 0-1 scale as micLevel. */
  micThreshold: number
  /** Whether right now is being treated as speech — the meter turns green. */
  speaking: boolean
  /**
   * Whether the Senti window is fully hidden right now. While hidden the mic
   * stays open and Senti still listens — you just can't see it. A wake phrase
   * ("hey Senti", "buddy", your name) brings it back; a dismiss phrase ("shut
   * up", "go away", "close") hides it again.
   */
  hidden: boolean

  start: () => Promise<void>
  stop: () => void
  /** Open a conversation on demand — the talk hotkey and the orb use this. */
  engage: () => void
  /** Hide Senti completely — still listening, just invisible. */
  dismiss: () => void
  /** Bring Senti back — shows the window and opens a conversation. */
  restore: () => void
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

/** Hide Senti completely — window disappears, mic stays open, listening continues. */
function dismissSenti(): void {
  useWakeStore.setState({ hidden: true, state: 'listening', detail: '' })
  setHud(false)
  void window.senti?.hideWindow?.()
  void say({ text: 'Okay.', audio: null }, deviceLang())
  // Stop watching the screen while hidden — the user dismissed Senti, which
  // means they want it out of their life for now. Screen access stops.
  import('../services/screenContext').then(({ stopScreenContext }) => stopScreenContext()).catch(() => {})
}

/** Bring Senti back — shows the window and opens a conversation. */
function restoreSenti(): void {
  useWakeStore.setState({ hidden: false, state: 'heard', detail: 'Listening…' })
  setHud(true)
  void window.senti?.restoreWindow?.()
  // Resume screen watching now that the user has called Senti back.
  import('../services/screenContext').then(({ startScreenContext }) => startScreenContext()).catch(() => {})
}

export const useWakeStore = create<WakeStore>((set, get) => ({
  state: 'off',
  detail: '',
  enabled: false,
  talking: false,
  lastHeard: '',
  status: 'Not listening.',
  micLevel: 0,
  micThreshold: 0,
  speaking: false,
  hidden: false,

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
      // Publish the speech cutoff alongside the level. Seeing the bar without
      // the line it has to cross tells you the mic works but not whether Senti
      // considers you audible — which is the actual question.
      const threshold = recorder?.getThreshold() ?? 0.02
      useWakeStore.setState({
        micLevel: Math.min(1, level.rms * 6),
        micThreshold: Math.min(1, threshold * 6),
        speaking: level.rms >= threshold,
      })
    })

    recorder?.stop()
    recorder = new UtteranceRecorder({
      maxUtteranceSec: MAX_UTTERANCE_SEC,
      silenceHangoverFrames: SILENCE_FRAMES,
    })
    recorder.onUtterance((u) => void onUtterance(u))
    recorder.start(audioCapture)
    set({ state: 'listening', detail: '', enabled: true, status: 'Listening.', hidden: false })
    // Start the background screen watcher so Senti can see what the user is
    // doing. It runs at low frequency (every 3s) and only when Senti is
    // actually listening — dismissed = no watching = no screen access.
    import('../services/screenContext').then(({ startScreenContext }) => startScreenContext()).catch(() => {})
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
    set({ state: 'off', detail: '', enabled: false, talking: false, hidden: false, status: 'Not listening.', micLevel: 0 })
  },

  engage: () => {
    // Hotkey / orb tap: open a conversation right now, no wake word. If Senti
    // isn't even listening (permission off), there's nothing to open.
    if (get().state === 'off') return
    beginConversation()
  },

  dismiss: () => {
    dismissSenti()
  },

  restore: () => {
    restoreSenti()
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

    // Dormant (not in a conversation): check for a Dismiss first, then a
    // Wake. Dismiss is higher priority because while hidden the user's intent
    // is almost always "come back" when they speak, and a stray "close" while
    // the window is already hidden should stay a no-op.
    const storeNow = useWakeStore.getState()
    if (storeNow.hidden) {
      // Hidden: only wake phrases matter. Dismiss is already done.
      const { woke, command } = parseWake(heard)
      if (!woke) return
      restoreSenti()
      beginConversation()
      if (command) await handleTurn(command)
      else await ackEngaged()
      return
    }

    // Visible but dormant: a dismiss phrase hides Senti immediately.
    const dismissResult = parseDismiss(heard)
    if (dismissResult.dismissed) {
      dismissSenti()
      return
    }

    // Normal wake-up path.
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
  reportActivity(text, true)

  const lang = deviceLang()
  const snap = await getSystemSnapshot()
  history.push({ role: 'user', content: text })

  // Grab the latest screen context so the LLM can see what's on screen.
  const screenCtx = useScreenContextStore.getState().current
  const ctxForLlm = screenCtx
    ? { summary: screenCtx.summary, apps: screenCtx.apps, activity: screenCtx.activity, label: screenCtx.label }
    : undefined

  // Local mode: no cloud, all Ollama + Piper on this machine.
  const localMode = useSettingsStore.getState().localMode

  let spoken: string
  let replyAudio: string | null = null

  if (localMode) {
    const brain = await getLocalBrain()
    const reply = await brain.localAsk(
      history.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content })),
      snap ? describeSystem(snap) : null,
      ctxForLlm
    )
    spoken = reply.text
    replyAudio = reply.audio
  } else {
    const reply = await askSenti(
      history.slice(-HISTORY_TURNS),
      lang,
      snap ? describeSystem(snap) : null,
      ctxForLlm
    )
    spoken = reply.text
    replyAudio = reply.audio

    if (reply.action) {
      useWakeStore.setState({ detail: 'Working…' })
      const outcome = await runAction(reply.action)
      if (outcome) spoken = outcome
    }
  }

  history.push({ role: 'assistant', content: spoken })
  reportActivity(spoken.slice(0, 120), false)

  useWakeStore.setState({ state: 'speaking', detail: spoken })
  await say({ text: spoken, audio: replyAudio }, lang)

  if (inConversation) {
    keepConversationAlive()
    useWakeStore.setState({ state: 'listening', detail: 'Listening…' })
  }
}
