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
 * wakeStore — hands-free Senti.
 *
 * Once you're unlocked, Senti keeps listening in the background. Say
 * "Senti, clean my system" from anywhere — VS Code, the desktop, a game — and
 * it wakes, shows a small HUD, does the thing, and speaks the result. No window
 * to open, no button to press.
 *
 * PRIVACY: every part of the listening happens on this machine. The microphone
 * feeds a local voice-activity detector, and only speech segments are
 * transcribed by Whisper running locally. Audio is never uploaded, and nothing
 * leaves the device unless the wake word actually fires — at which point only
 * the TEXT of your command is sent to the assistant.
 */

export type WakeState =
  | 'off' // not listening
  | 'listening' // waiting for the wake word
  | 'heard' // wake word caught, capturing the command
  | 'working' // thinking / acting
  | 'speaking'

// A wake utterance is short; a command can run longer.
const WAKE_MAX_SEC = 6
const COMMAND_MAX_SEC = 15
const COMMAND_SILENCE_FRAMES = 22
const FOLLOWUP_TIMEOUT_MS = 8000

let recorder: UtteranceRecorder | null = null
let unsubscribeLevel: (() => void) | null = null
let lastLevelAt = 0
let busy = false
let awaitingCommand = false
let followupTimer: number | null = null

export interface WakeStore {
  state: WakeState
  /** What Senti is doing right now, shown in the HUD. */
  detail: string
  enabled: boolean
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
}

/**
 * A short rising two-tone chime the instant the wake word lands.
 *
 * Hands-free needs an answer before Senti has finished thinking, or you're left
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

export const useWakeStore = create<WakeStore>((set, get) => ({
  state: 'off',
  detail: '',
  enabled: false,
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
      maxUtteranceSec: WAKE_MAX_SEC,
      silenceHangoverFrames: COMMAND_SILENCE_FRAMES,
    })
    recorder.onUtterance((u) => void onUtterance(u))
    recorder.start(audioCapture)
    set({ state: 'listening', detail: '', enabled: true, status: 'Listening.' })
  },

  stop: () => {
    unsubscribeLevel?.()
    unsubscribeLevel = null
    if (followupTimer !== null) {
      clearTimeout(followupTimer)
      followupTimer = null
    }
    recorder?.stop()
    recorder = null
    audioCapture.stop()
    awaitingCommand = false
    setHud(false)
    set({ state: 'off', detail: '', enabled: false, status: 'Not listening.', micLevel: 0 })
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

    let command = ''

    if (awaitingCommand) {
      // We already woke and asked "yes?" — this utterance IS the command.
      command = heard
      awaitingCommand = false
      if (followupTimer !== null) {
        clearTimeout(followupTimer)
        followupTimer = null
      }
    } else {
      const { woke, command: inline } = parseWake(heard)
      if (!woke) return // not for us — stay quiet, keep listening

      if (!inline) {
        // Just the name: open the HUD and wait for the command.
        awaitingCommand = true
        useWakeStore.setState({ state: 'heard', detail: 'Yes? Go ahead.' })
        playWakeChime()
        setHud(true)
        followupTimer = window.setTimeout(() => {
          followupTimer = null
          awaitingCommand = false
          setHud(false)
          useWakeStore.setState({ state: 'listening', detail: '' })
        }, FOLLOWUP_TIMEOUT_MS)
        return
      }
      command = inline
    }

    await handleCommand(command)
  } catch {
    useWakeStore.setState({ state: 'listening', detail: '' })
    setHud(false)
  } finally {
    busy = false
  }
}

async function handleCommand(command: string): Promise<void> {
  playWakeChime()
  setHud(true)
  useWakeStore.setState({ state: 'working', detail: command })
  // So your phone sees what you asked it to do, live.
  reportActivity(command, true)

  const lang = deviceLang()
  const snap = await getSystemSnapshot()
  const turns: ChatTurn[] = [{ role: 'user', content: command }]
  const reply = await askSenti(turns, lang, snap ? describeSystem(snap) : null)

  // Carry out whatever it decided to do.
  let spoken = reply.text
  if (reply.action) {
    useWakeStore.setState({ detail: 'Working…' })
    const outcome = await runAction(reply.action)
    if (outcome) spoken = outcome
  }

  reportActivity(spoken.slice(0, 120), false)

  useWakeStore.setState({ state: 'speaking', detail: spoken })
  await say({ text: spoken, audio: spoken === reply.text ? reply.audio : null }, lang)

  // Back to quietly listening, and get out of the way.
  useWakeStore.setState({ state: 'listening', detail: '' })
  window.setTimeout(() => {
    if (useWakeStore.getState().state === 'listening') setHud(false)
  }, 1200)
}
