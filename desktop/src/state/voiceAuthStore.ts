import { create } from 'zustand'
import { audioCapture } from '../services/audioCapture'
import { UtteranceRecorder } from '../services/utteranceRecorder'
import { voiceEmbeddingEngine, cosineSimilarity } from '../services/voiceEmbeddingEngine'
import { audioManager } from '../services/audioManager'
import { useVoiceProfileStore } from './voiceProfileStore'
import { useSettingsStore } from './settingsStore'
import { useLockStore } from './lockStore'
import type { Utterance } from '../types/audio'

/**
 * voiceAuthStore - click-to-listen voice unlock.
 *
 * The mic is OFF until the user taps "Voice Unlock". Then Senti listens
 * for ONE utterance, verifies it against the enrolled voiceprint, and
 * either unlocks or returns to idle. It never listens in the background,
 * so someone talking nearby can't trigger or interfere with an unlock.
 */

export type VoiceUnlockState =
  | 'idle'         // mic off, waiting for the user to tap Voice Unlock
  | 'loading'      // engine/mic starting
  | 'listening'    // listening for the user's voice (single-shot)
  | 'verifying'    // scoring the captured utterance
  | 'rejected'     // last utterance did not match (transient) -> idle
  | 'matched'      // unlocked by voice
  | 'unavailable'  // no profile / method disabled / mic or model error

// Stop listening if the user taps but doesn't speak.
const LISTEN_TIMEOUT_MS = 8000
const REJECTED_FEEDBACK_MS = 2000

/**
 * Below this, there isn't enough audio to judge a voice reliably. We keep
 * listening rather than rejecting, so a cough or a clipped word never counts
 * as "not your voice".
 */
const MIN_VERIFY_SEC = 0.7

let recorder: UtteranceRecorder | null = null
let busy = false
let listenTimer: number | null = null
let rejectTimer: number | null = null

function clearTimers() {
  if (listenTimer !== null) {
    clearTimeout(listenTimer)
    listenTimer = null
  }
  if (rejectTimer !== null) {
    clearTimeout(rejectTimer)
    rejectTimer = null
  }
}

/** Stop the mic + recorder without changing the store state. */
function stopCapture() {
  clearTimers()
  recorder?.stop()
  recorder = null
  audioCapture.stop()
}

export interface VoiceAuthStore {
  state: VoiceUnlockState
  attempts: number
  lastScore: number | null
  error: string | null

  /** User-initiated: begin a single listen-and-verify. */
  startSession: () => Promise<void>
  stopSession: (nextState?: VoiceUnlockState) => void
  resetAttempts: () => void
}

export const useVoiceAuthStore = create<VoiceAuthStore>((set, get) => ({
  state: 'idle',
  attempts: 0,
  lastScore: null,
  error: null,

  startSession: async () => {
    const current = get().state
    if (current === 'loading' || current === 'listening' || current === 'verifying') return

    const profile = useVoiceProfileStore.getState().profile
    const voiceEnabled = useSettingsStore.getState().security.enabledMethods.includes('voice')
    if (!profile || !voiceEnabled) {
      set({ state: 'unavailable' })
      return
    }

    set({ state: 'loading', error: null })
    try {
      await voiceEmbeddingEngine.load()
      await audioCapture.start()
    } catch (err) {
      set({
        state: 'unavailable',
        error: err instanceof Error ? err.message : 'Voice unlock unavailable',
      })
      return
    }

    recorder?.stop()
    recorder = new UtteranceRecorder()
    recorder.onUtterance((utterance) => {
      void handleUtterance(utterance)
    })
    recorder.start(audioCapture)
    set({ state: 'listening' })

    // Auto-stop if nothing is spoken.
    listenTimer = window.setTimeout(() => {
      listenTimer = null
      const s = get().state
      if (s === 'listening' || s === 'loading') {
        stopCapture()
        set({ state: 'idle' })
      }
    }, LISTEN_TIMEOUT_MS)
  },

  stopSession: (nextState: VoiceUnlockState = 'idle') => {
    stopCapture()
    set({ state: nextState })
  },

  resetAttempts: () => set({ attempts: 0, lastScore: null }),
}))

async function handleUtterance(utterance: Utterance): Promise<void> {
  if (busy) return
  // Single-shot: only the first utterance of a listen is processed.
  if (useVoiceAuthStore.getState().state !== 'listening') return

  // Too little audio to judge — stay listening and wait for a real utterance.
  if (utterance.duration < MIN_VERIFY_SEC) return

  busy = true
  clearTimers()
  // Stop capturing immediately — we only verify this one utterance.
  recorder?.stop()
  recorder = null
  useVoiceAuthStore.setState({ state: 'verifying' })

  try {
    const { profile, threshold } = useVoiceProfileStore.getState()
    if (!profile) {
      useVoiceAuthStore.getState().stopSession('unavailable')
      return
    }

    // Voice-only unlock: is this the enrolled speaker?
    const embedding = await voiceEmbeddingEngine.computeEmbedding(utterance)
    const score = cosineSimilarity(embedding, profile.embedding)

    // Done verifying — release the mic either way.
    audioCapture.stop()

    if (score >= threshold) {
      useVoiceAuthStore.setState({ lastScore: score, state: 'matched' })
      audioManager.play('unlock')
      useLockStore.getState().authSuccess()
      return
    }

    // Rejected: not the enrolled voice. Show feedback, then return to idle.
    audioManager.play('denied')
    const attempts = useVoiceAuthStore.getState().attempts + 1
    useVoiceAuthStore.setState({ attempts, lastScore: score, state: 'rejected' })
    rejectTimer = window.setTimeout(() => {
      rejectTimer = null
      if (useVoiceAuthStore.getState().state === 'rejected') {
        useVoiceAuthStore.setState({ state: 'idle' })
      }
    }, REJECTED_FEEDBACK_MS)
  } catch {
    useVoiceAuthStore.getState().stopSession('unavailable')
  } finally {
    busy = false
  }
}
