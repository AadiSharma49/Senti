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
 * voiceAuthStore - orchestrates the live voice unlock session on the
 * lock screen.
 *
 * Session lifecycle: LockScreen starts a session when locked and stops
 * it when unlocked (or while the settings panel is open). Each captured
 * utterance is scored against the enrolled voice profile:
 *   match            -> lockStore.authSuccess()
 *   3rd rejection    -> fall back to PIN entry (per auth priority chain)
 *
 * Voice rejections do NOT feed lockStore.authFail(): the PIN lockout
 * counter is reserved for PIN attempts, so background speech can never
 * lock the user out.
 */

export type VoiceUnlockState =
  | 'idle'         // no session
  | 'loading'      // engine/mic starting
  | 'listening'    // waiting for the passphrase
  | 'verifying'    // scoring an utterance
  | 'rejected'     // last utterance did not match (transient)
  | 'matched'      // unlocked by voice
  | 'fallback'     // voice attempts exhausted, PIN required
  | 'unavailable'  // no profile / method disabled / mic or model error

const MAX_VOICE_ATTEMPTS = 3
const REJECTED_FEEDBACK_MS = 1800

let recorder: UtteranceRecorder | null = null
let busy = false
let rejectTimer: number | null = null

export interface VoiceAuthStore {
  state: VoiceUnlockState
  attempts: number
  lastScore: number | null
  error: string | null

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
    if (get().attempts >= MAX_VOICE_ATTEMPTS) {
      set({ state: 'fallback' })
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

    const lock = useLockStore.getState()
    if (lock.state === 'locked') {
      lock.startVoiceAttempt()
    }
  },

  stopSession: (nextState: VoiceUnlockState = 'idle') => {
    if (rejectTimer !== null) {
      clearTimeout(rejectTimer)
      rejectTimer = null
    }
    recorder?.stop()
    recorder = null
    audioCapture.stop()
    set({ state: nextState })
  },

  resetAttempts: () => set({ attempts: 0, lastScore: null }),
}))

async function handleUtterance(utterance: Utterance): Promise<void> {
  if (busy) return
  if (useVoiceAuthStore.getState().state !== 'listening') return
  busy = true
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

    if (score >= threshold) {
      useVoiceAuthStore.setState({ lastScore: score })
      useVoiceAuthStore.getState().stopSession('matched')
      audioManager.play('unlock')
      useLockStore.getState().authSuccess()
      return
    }

    // Rejected: not the enrolled voice.
    audioManager.play('denied')
    const attempts = useVoiceAuthStore.getState().attempts + 1
    if (attempts >= MAX_VOICE_ATTEMPTS) {
      useVoiceAuthStore.setState({ attempts, lastScore: score })
      useVoiceAuthStore.getState().stopSession('fallback')
      const lock = useLockStore.getState()
      if (lock.state === 'listening_voice') {
        lock.enterPinEntry()
      }
    } else {
      useVoiceAuthStore.setState({ attempts, lastScore: score, state: 'rejected' })
      rejectTimer = window.setTimeout(() => {
        rejectTimer = null
        if (useVoiceAuthStore.getState().state === 'rejected') {
          useVoiceAuthStore.setState({ state: 'listening' })
        }
      }, REJECTED_FEEDBACK_MS)
    }
  } catch {
    useVoiceAuthStore.getState().stopSession('unavailable')
  } finally {
    busy = false
  }
}
