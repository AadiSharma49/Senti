import { create } from 'zustand'
import { audioCapture } from '../services/audioCapture'
import { UtteranceRecorder } from '../services/utteranceRecorder'
import { loadSpeechRecognition, transcribeRaw } from '../services/speechRecognition'
import { askSenti, type ChatTurn } from '../services/assistantService'
import { getSystemSnapshot, describeSystem } from '../services/systemInfo'
import { say, deviceLang } from '../services/greetingService'
import { runAction } from '../services/actions'
import { useSettingsStore } from './settingsStore'
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

/** Whisper mishears the name in predictable ways; accept the near-misses. */
const WAKE_PATTERNS = [
  'senti', 'sentai', 'sente', 'sentie', 'sensei', 'sanity', 'centi', 'century',
  'sentry', 'santi', 'shanti', 'sentio', 'set me', 'send it',
]

/** Strip the wake word off the front and return whatever command remains. */
function parseWake(textRaw: string): { woke: boolean; command: string } {
  const text = textRaw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return { woke: false, command: '' }

  for (const w of WAKE_PATTERNS) {
    // Only treat it as a wake if the name starts the utterance — otherwise
    // saying "senti" mid-sentence in a call would trigger it.
    if (text === w) return { woke: true, command: '' }
    if (text.startsWith(w + ' ')) {
      return { woke: true, command: textRaw.trim().slice(w.length).replace(/^[\s,.:!-]+/, '') }
    }
  }
  return { woke: false, command: '' }
}

// A wake utterance is short; a command can run longer.
const WAKE_MAX_SEC = 6
const COMMAND_MAX_SEC = 15
const COMMAND_SILENCE_FRAMES = 22
const FOLLOWUP_TIMEOUT_MS = 8000

let recorder: UtteranceRecorder | null = null
let busy = false
let awaitingCommand = false
let followupTimer: number | null = null

export interface WakeStore {
  state: WakeState
  /** What Senti is doing right now, shown in the HUD. */
  detail: string
  enabled: boolean

  start: () => Promise<void>
  stop: () => void
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

  start: async () => {
    if (get().state !== 'off') return
    if (!useSettingsStore.getState().permissions.alwaysListening) return

    try {
      await Promise.all([loadSpeechRecognition(), audioCapture.start()])
    } catch {
      set({ state: 'off', detail: '' })
      return
    }

    recorder?.stop()
    recorder = new UtteranceRecorder({
      maxUtteranceSec: WAKE_MAX_SEC,
      silenceHangoverFrames: COMMAND_SILENCE_FRAMES,
    })
    recorder.onUtterance((u) => void onUtterance(u))
    recorder.start(audioCapture)
    set({ state: 'listening', detail: '', enabled: true })
  },

  stop: () => {
    if (followupTimer !== null) {
      clearTimeout(followupTimer)
      followupTimer = null
    }
    recorder?.stop()
    recorder = null
    audioCapture.stop()
    awaitingCommand = false
    setHud(false)
    set({ state: 'off', detail: '', enabled: false })
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
        useWakeStore.setState({ state: 'heard', detail: 'Listening…' })
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
  setHud(true)
  useWakeStore.setState({ state: 'working', detail: command })

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

  useWakeStore.setState({ state: 'speaking', detail: spoken })
  await say({ text: spoken, audio: spoken === reply.text ? reply.audio : null }, lang)

  // Back to quietly listening, and get out of the way.
  useWakeStore.setState({ state: 'listening', detail: '' })
  window.setTimeout(() => {
    if (useWakeStore.getState().state === 'listening') setHud(false)
  }, 1200)
}
