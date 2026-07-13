import { create } from 'zustand'

/**
 * voiceProfileStore - persisted voice enrollment profile + security policy.
 *
 * Unlock is VOICE ONLY: the user can say anything at all, and Senti unlocks
 * if the voiceprint matches. There is no wake phrase, keyword, or passphrase
 * anywhere in the system — identity is proven by WHO is speaking, not WHAT
 * they say.
 *
 * The profile is plain data (a speaker embedding + metadata), so its source
 * can later move from localStorage to the dashboard API without touching the
 * verification engine.
 */

/** Minimum similarity for a voice match. Tunable; synced from dashboard policy. */
export const DEFAULT_VOICE_THRESHOLD = 0.5

export interface VoiceProfile {
  /** Averaged, L2-normalized speaker embedding */
  embedding: number[]
  /** How many enrollment utterances were averaged */
  sampleCount: number
  /** Embedding model the profile was created with */
  modelId: string
  /** Creation time (ISO string) */
  createdAt: string
}

export interface VoiceProfileState {
  profile: VoiceProfile | null
  threshold: number

  setProfile: (profile: VoiceProfile) => void
  clearProfile: () => void
  setThreshold: (threshold: number) => void
}

const STORAGE_KEY = 'senti:voiceProfile'
const THRESHOLD_KEY = 'senti:voiceThreshold'

// Drop the retired wake-phrase mode so old installs can't resurrect it.
try {
  localStorage.removeItem('senti:securityMode')
} catch {}

const safeLoad = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const persist = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export const useVoiceProfileStore = create<VoiceProfileState>((set) => ({
  profile: safeLoad<VoiceProfile | null>(STORAGE_KEY, null),
  threshold: safeLoad<number>(THRESHOLD_KEY, DEFAULT_VOICE_THRESHOLD),

  setProfile: (profile) => {
    persist(STORAGE_KEY, profile)
    set({ profile })
  },

  clearProfile: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    set({ profile: null })
  },

  setThreshold: (threshold) => {
    persist(THRESHOLD_KEY, threshold)
    set({ threshold })
  },
}))
