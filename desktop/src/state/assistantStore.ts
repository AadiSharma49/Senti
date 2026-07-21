import { create } from 'zustand'
import { audioCapture } from '../services/audioCapture'
import { UtteranceRecorder } from '../services/utteranceRecorder'
import { loadSpeechRecognition, transcribeRaw } from '../services/speechRecognition'
import { askSenti, type ChatTurn } from '../services/assistantService'
import { getSystemSnapshot, describeSystem } from '../services/systemInfo'
import { say, deviceLang } from '../services/greetingService'
import { useSettingsStore } from './settingsStore'
import type { Utterance } from '../types/audio'

/**
 * assistantStore — Senti's conversational agent ("Jarvis").
 *
 * Push-to-talk: the user taps the mic, Senti listens for ONE spoken turn,
 * transcribes it on-device (Whisper, any language), sends the conversation to
 * its brain (Gemini via the dashboard), then speaks the reply (ElevenLabs, or
 * the browser voice as a fallback). The mic is never open in the background.
 */

export type AssistantStatus =
  | 'idle' // waiting for the user to tap the mic
  | 'loading' // engine/mic starting
  | 'listening' // capturing the user's spoken turn
  | 'transcribing' // turning speech into text
  | 'thinking' // waiting on Senti's reply
  | 'speaking' // playing Senti's spoken reply

export interface AssistantMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
}

// The "user tapped but hasn't started speaking" timeout. Generous so it doesn't
// give up while you gather your thought.
const LISTEN_TIMEOUT_MS = 15000

// Conversational listening: record up to 20s per turn, and wait ~1.2s of
// silence before ending — so a normal pause mid-sentence doesn't cut you off.
const ASSISTANT_MAX_UTTERANCE_SEC = 20
const ASSISTANT_SILENCE_HANGOVER_FRAMES = 24

let recorder: UtteranceRecorder | null = null
let listenTimer: number | null = null
let busy = false
let msgId = 0

function clearListenTimer() {
  if (listenTimer !== null) {
    clearTimeout(listenTimer)
    listenTimer = null
  }
}

function stopCapture() {
  clearListenTimer()
  recorder?.stop()
  recorder = null
  audioCapture.stop()
}

export interface AssistantStore {
  open: boolean
  status: AssistantStatus
  messages: AssistantMessage[]
  error: string | null

  show: () => void
  hide: () => void
  /** User-initiated: listen for one spoken turn, then answer. */
  startListen: () => Promise<void>
  /** Stop listening without answering (mic off). */
  stopListen: () => void
  clear: () => void
}

export const useAssistantStore = create<AssistantStore>((set, get) => ({
  open: false,
  status: 'idle',
  messages: [],
  error: null,

  show: () => set({ open: true }),

  hide: () => {
    stopCapture()
    set({ open: false, status: 'idle' })
  },

  startListen: async () => {
    const status = get().status
    if (status !== 'idle') return // already busy

    set({ status: 'loading', error: null })
    try {
      // Warm the speech model and mic together.
      await Promise.all([loadSpeechRecognition(), audioCapture.start()])
    } catch (err) {
      set({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Microphone or speech model unavailable',
      })
      return
    }

    recorder?.stop()
    recorder = new UtteranceRecorder({
      maxUtteranceSec: ASSISTANT_MAX_UTTERANCE_SEC,
      silenceHangoverFrames: ASSISTANT_SILENCE_HANGOVER_FRAMES,
    })
    recorder.onUtterance((u) => {
      void handleUtterance(u)
    })
    recorder.start(audioCapture)
    set({ status: 'listening' })

    // Give up if the user taps but never speaks.
    listenTimer = window.setTimeout(() => {
      listenTimer = null
      if (get().status === 'listening' || get().status === 'loading') {
        stopCapture()
        set({ status: 'idle' })
      }
    }, LISTEN_TIMEOUT_MS)
  },

  stopListen: () => {
    stopCapture()
    if (get().status === 'listening' || get().status === 'loading') set({ status: 'idle' })
  },

  clear: () => set({ messages: [], error: null }),
}))

/**
 * Carry out an action the model asked for.
 *
 * Two gates before anything happens: the user's permission dial, and the
 * whitelist in the main process. Returns a replacement line to speak when the
 * outcome differs from what the model assumed, or null to keep its wording.
 */
async function runAction(action: { name: string; args: Record<string, unknown> }): Promise<string | null> {
  const perms = useSettingsStore.getState().permissions
  const senti = window.senti
  const target = String(action.args?.name ?? '')
  const denied = (what: string) => `I'm not allowed to ${what}. You can turn that on in Settings.`

  switch (action.name) {
    case 'open_app': {
      if (!perms.openApps) return denied('open apps')
      const res = await senti?.openApp?.(target)
      if (res?.ok) return `Opening ${res.label ?? target}.`
      if (res?.error === 'unknown') return `I don't know how to open ${target} yet.`
      return `I couldn't open ${target}.`
    }

    case 'close_app': {
      if (!perms.closeApps) return denied('close apps')
      const res = await senti?.closeApp?.(target)
      if (res?.ok) return `Closed ${res.label ?? target}.`
      if (res?.error === 'unknown') return `I can't close ${target} yet.`
      return `I couldn't close ${target}.`
    }

    case 'clean_temp': {
      if (!perms.cleanup) return denied('delete temporary files')
      const res = await senti?.cleanTemp?.()
      if (!res) return "I couldn't clean up just now."
      if (res.files === 0) return 'Nothing to clean — your temp folders are already clear.'
      return `Done. I freed ${res.freedMB === 0 ? 'under a megabyte' : res.freedMB + ' megabytes'} by deleting ${res.files} temporary files.`
    }

    case 'lock_workstation': {
      if (!perms.systemControl) return denied('lock your PC')
      const ok = await senti?.lockWorkstation?.()
      return ok ? 'Locking your PC.' : "I couldn't lock it."
    }

    case 'set_volume': {
      if (!perms.systemControl) return denied('change the volume')
      const dir = action.args?.direction
      const d = dir === 'up' || dir === 'down' || dir === 'mute' ? dir : null
      if (!d) return null
      const ok = await senti?.volume?.(d)
      if (!ok) return "I couldn't change the volume."
      return d === 'mute' ? 'Muted.' : d === 'up' ? 'Turning it up.' : 'Turning it down.'
    }

    default:
      return null
  }
}

async function handleUtterance(utterance: Utterance): Promise<void> {
  if (busy) return
  if (useAssistantStore.getState().status !== 'listening') return
  busy = true
  clearListenTimer()
  // One turn only — stop the mic while we think and speak.
  recorder?.stop()
  recorder = null
  audioCapture.stop()

  try {
    useAssistantStore.setState({ status: 'transcribing' })
    const question = (await transcribeRaw(utterance)).trim()
    if (!question) {
      // Nothing intelligible — quietly return to idle.
      useAssistantStore.setState({ status: 'idle' })
      return
    }

    const lang = deviceLang()
    const userMsg: AssistantMessage = { id: ++msgId, role: 'user', content: question }
    useAssistantStore.setState((s) => ({ messages: [...s.messages, userMsg], status: 'thinking' }))

    const history: ChatTurn[] = useAssistantStore
      .getState()
      .messages.map((m) => ({ role: m.role, content: m.content }))

    // Senti's edge over a cloud chatbot: it can see this machine. Attach the
    // vitals so "why is my PC slow?" gets answered with real numbers.
    const snap = await getSystemSnapshot()
    const reply = await askSenti(history, lang, snap ? describeSystem(snap) : null)

    // Do the thing, if Senti was asked to — and only if it's permitted.
    let spoken = reply.text
    if (reply.action) {
      const result = await runAction(reply.action)
      if (result) spoken = result
    }

    const botMsg: AssistantMessage = { id: ++msgId, role: 'assistant', content: spoken }
    useAssistantStore.setState((s) => ({ messages: [...s.messages, botMsg], status: 'speaking' }))

    // Speak it (human voice if available, else the browser voice). If an action
    // changed what we say, fall back to the browser voice for that line.
    await say({ text: spoken, audio: spoken === reply.text ? reply.audio : null }, lang)
  } catch (err) {
    useAssistantStore.setState({
      error: err instanceof Error ? err.message : 'Something went wrong',
    })
  } finally {
    busy = false
    // Back to idle so the user can ask a follow-up.
    if (useAssistantStore.getState().status !== 'idle')
      useAssistantStore.setState({ status: 'idle' })
  }
}
