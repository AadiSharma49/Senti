import { isEditorAction } from '../../../shared/codeBridgeActions'
import { create } from 'zustand'
import { audioCapture, AudioCapture } from '../services/audioCapture'
import { listeningStatus, resolveMic } from '../services/micChoice'
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
import { startScreenContext, stopScreenContext } from '../services/screenContext'
import type { Utterance } from '../types/audio'

/**
 * wakeStore — talking to Sentinel, hands-free.
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

/**
 * Microphone hot-plug. Without this, unplugging the mic Sentinel was using left
 * capture silent forever, and plugging the chosen mic back in did nothing until
 * a restart — both indistinguishable from "it just stopped hearing me".
 */
let micWatchInstalled = false
/** Listening stopped because every microphone disappeared; resume when one returns. */
let micLost = false
/** The chosen mic came back mid-conversation; switch once the conversation ends. */
let micSwitchPending = false
let reopening = false
let starting = false
let deviceChangeTimer: number | null = null

/** True while a conversation is open (every utterance is for Senti). */
let inConversation = false
let idleTimer: number | null = null
/** The running back-and-forth, so replies have context. Cleared on exit. */
let history: ChatTurn[] = []

export interface WakeStore {
  state: WakeState
  /** What Senti is doing right now, shown in the HUD. */
  detail: string
  /** Last bounded editor reply, held only in memory so long results can be read after the HUD closes. */
  editorResult: string
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
  /** Re-open the microphone after the user picks a different one. */
  switchMic: () => Promise<void>
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
  if (micSwitchPending) void reopenMic()
}

/**
 * Re-open capture on the best microphone available right now (the chosen
 * one if it's connected, else the Windows default), WITHOUT disturbing the
 * rest of the listening state: visibility, conversation and the level meter
 * all carry on. Only the audio source changes.
 */
async function reopenMic(): Promise<void> {
  if (reopening || useWakeStore.getState().state === 'off') return
  reopening = true
  micSwitchPending = false
  try {
    recorder?.stop()
    audioCapture.stop()
    try {
      await audioCapture.start()
    } catch {
      // Nothing left to listen on. Stop properly — the orb must not keep
      // claiming it can hear you — and resume when a mic is plugged back in.
      useWakeStore.getState().stop()
      micLost = true
      useWakeStore.setState({
        status: 'Your microphone was disconnected. Plug one in and Senti will start listening again.',
      })
      return
    }
    recorder?.start(audioCapture)
    useWakeStore.setState({ status: listeningStatus(audioCapture.getStatus().fallbackFrom) })
  } finally {
    reopening = false
  }
}

/** Debounced: Windows fires several devicechange events per plug/unplug. */
function onDeviceChange(): void {
  if (deviceChangeTimer !== null) clearTimeout(deviceChangeTimer)
  deviceChangeTimer = window.setTimeout(() => {
    deviceChangeTimer = null
    void (async () => {
      const store = useWakeStore.getState()
      if (store.state === 'off') {
        if (micLost && useSettingsStore.getState().permissions.alwaysListening) {
          micLost = false
          await store.start()
        }
        return
      }
      // On the fallback because the chosen mic was missing — is it back?
      if (!audioCapture.getStatus().fallbackFrom) return
      const back = resolveMic(AudioCapture.savedMic(), await AudioCapture.inventory())
      if (back.kind !== 'chosen' && back.kind !== 'relabeled') return
      // Don't yank the mic out from under someone mid-sentence.
      if (inConversation || busy) micSwitchPending = true
      else await reopenMic()
    })()
  }, 800)
}

function installMicWatch(): void {
  if (micWatchInstalled) return
  micWatchInstalled = true
  audioCapture.onDeviceLost(() => void reopenMic())
  try {
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
  } catch {
    // no mediaDevices (tests / browser without media) — nothing to watch
  }
}

/** Hide Senti completely — window disappears, mic stays open, listening continues. */
function dismissSenti(): void {
  useWakeStore.setState({ hidden: true, state: 'listening', detail: '' })
  setHud(false)
  void window.senti?.hideWindow?.()
  void say({ text: 'Okay.', audio: null }, deviceLang())
  // Stop watching the screen while hidden — the user dismissed Sentinel, which
  // means they want it out of the way for now.
  stopScreenContext()
}

/** Bring Sentinel back — shows the window and opens a conversation. */
function restoreSenti(): void {
  useWakeStore.setState({ hidden: false, state: 'heard', detail: 'Listening…' })
  setHud(true)
  void window.senti?.restoreWindow?.()
  const { watchScreen, seeScreen } = useSettingsStore.getState().permissions
  if (watchScreen && seeScreen) startScreenContext()
}

export const useWakeStore = create<WakeStore>((set, get) => ({
  state: 'off',
  detail: '',
  editorResult: '',
  enabled: false,
  talking: false,
  lastHeard: '',
  status: 'Not listening.',
  micLevel: 0,
  micThreshold: 0,
  speaking: false,
  hidden: false,

  start: async () => {
    if (get().state !== 'off' || starting) return
    if (!useSettingsStore.getState().permissions.alwaysListening) return
    // Guards the seconds spent loading the model and opening the mic, during
    // which state is still 'off' — a second start() then would open a second,
    // leaked microphone stream.
    starting = true

    // Load the speech model + mic. Retry once — a cold start right after
    // unlock can lose the race for the mic, and we must not end up silently
    // not listening.
    //
    // The two are loaded separately so a failure can say WHICH one broke. They
    // used to share one catch, and "Senti is quiet" was the only symptom of
    // either.
    set({ status: 'Starting up…' })
    installMicWatch()
    micLost = false
    let started = false
    let why = ''
    let noMic = false
    for (let attempt = 0; attempt < 2 && !started; attempt++) {
      try {
        await loadSpeechRecognition()
      } catch {
        why = 'The speech model could not load, so Senti cannot understand you.'
        noMic = false
        await new Promise((r) => setTimeout(r, 1200))
        continue
      }
      try {
        await audioCapture.start()
        started = true
      } catch {
        why = 'No microphone. Check that one is plugged in and that Windows lets Senti use it.'
        noMic = true
        await new Promise((r) => setTimeout(r, 1200))
      }
    }
    if (!started) {
      // A missing mic fixes itself when one is plugged in — pick it up then.
      micLost = noMic
      starting = false
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
    starting = false
    set({
      state: 'listening',
      detail: '',
      enabled: true,
      status: listeningStatus(audioCapture.getStatus().fallbackFrom),
      hidden: false,
    })
    const { watchScreen, seeScreen } = useSettingsStore.getState().permissions
    if (watchScreen && seeScreen) startScreenContext()
  },

  stop: () => {
    stopScreenContext()
    micLost = false
    micSwitchPending = false
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

  switchMic: async () => {
    if (get().state === 'off') {
      // Not listening (maybe because the old mic was missing) — try again on the new one.
      if (useSettingsStore.getState().permissions.alwaysListening && useSettingsStore.getState().setupCompleted) {
        await get().start()
      }
      return
    }
    await reopenMic()
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

  if (utterance.duration < 0.4) return

  busy = true
  try {
    const heard = (await transcribeRaw(utterance)).trim()
    if (!heard) return
    useWakeStore.setState({ lastHeard: heard })

    if (inConversation) {
      if (isEndPhrase(heard)) {
        endConversation(true)
        return
      }
      keepConversationAlive()
      await handleTurn(heard)
      return
    }

    const storeNow = useWakeStore.getState()
    if (storeNow.hidden) {
      const { woke, command } = parseWake(heard)
      if (!woke) return
      restoreSenti()
      beginConversation()
      if (command) await handleTurn(command)
      else await ackEngaged()
      return
    }

    const dismissResult = parseDismiss(heard)
    if (dismissResult.dismissed) {
      dismissSenti()
      return
    }

    const { woke, command } = parseWake(heard)
    if (!woke) return

    beginConversation()
    if (command) await handleTurn(command)
    else await ackEngaged()
  } catch {
    // An IPC/network failure is not a successful action. Don't leave the
    // conversation stuck working, holding the machine awake indefinitely.
    reportActivity('Voice request interrupted', false)
    if (inConversation) useWakeStore.setState({ state: 'listening', detail: 'Request interrupted.' })
  } finally {
    busy = false
    if (inConversation) keepConversationAlive()
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
  // Editor approval and configured tests may legitimately take longer than
  // the idle timeout. That timer is for silence BETWEEN turns, not active work.
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = null
  setHud(true)
  useWakeStore.setState({ state: 'working', detail: text })
  reportActivity('Responding to a voice request', true)

  const lang = deviceLang()
  const snap = await getSystemSnapshot()
  const userTurn: ChatTurn = { role: 'user', content: text }

  // Attach recent screen context only when opt-in background watching is active.
  const { watchScreen, seeScreen } = useSettingsStore.getState().permissions
  const screenCtx = useScreenContextStore.getState().current
  const ctxFresh = !!screenCtx && Date.now() - screenCtx.ts < 5 * 60_000
  const ctxForLlm =
    watchScreen && seeScreen && screenCtx && ctxFresh
      ? { summary: screenCtx.summary, apps: screenCtx.apps, activity: screenCtx.activity, label: screenCtx.label }
      : undefined

  const reply = await askSenti(
    [...history, userTurn].slice(-HISTORY_TURNS),
    lang,
    snap ? describeSystem(snap) : null,
    ctxForLlm,
    true
  )
  if (!inConversation) {
    reportActivity('Idle', false)
    return
  }
  let spoken = reply.text
  let audio = reply.audio
  const privateResult = !!reply.action && isEditorAction(reply.action.name)
  if (reply.action) {
    useWakeStore.setState({ detail: 'Working…' })
    const outcome = await runAction(reply.action, 'voice')
    if (outcome !== null) {
      spoken = outcome
      audio = null // the model's recording describes a prediction, not this outcome
    }
  }

  if (!inConversation) {
    reportActivity('Idle', false)
    return
  }
  if (privateResult && useSettingsStore.getState().permissions.codeBridge) {
    useWakeStore.setState({ editorResult: spoken })
  }
  if (!privateResult && text.length <= 4000 && spoken.length <= 4000) {
    history.push(userTurn, { role: 'assistant', content: spoken })
    history = history.slice(-HISTORY_TURNS)
  }
  reportActivity(privateResult ? 'Local VS Code request finished' : spoken.slice(0, 120), false)

  // Don't let the wake recorder hear the editor reply through the speakers and
  // transcribe it as the user's next turn. stop() also discards its pre-roll.
  const paused = privateResult ? recorder : null
  paused?.stop()
  useWakeStore.setState({ state: 'speaking', detail: spoken })
  try {
    await Promise.all([
      say({ text: spoken, audio, localOnly: privateResult }, lang),
      // Keep the HUD readable even on a machine with no speech service.
      privateResult ? new Promise(r => setTimeout(r, 2200)) : undefined,
    ])
  } finally {
    if (paused && recorder === paused) paused.start(audioCapture)
  }

  if (inConversation) useWakeStore.setState({ state: 'listening', detail: 'Listening…' })
}
