import { create } from 'zustand'

/**
 * voiceProfileStore - persisted voice enrollment profile.
 *
 * The profile is plain data (a speaker embedding + metadata), so its
 * source can later move from localStorage to the dashboard API without
 * touching the verification engine.
 *
 * No inference logic here - embeddings are computed by
 * voiceEmbeddingEngine and only stored/compared via this store's data.
 */

/** Minimum similarity for a voice match. Tunable; will become a dashboard-synced policy. */
export const DEFAULT_VOICE_THRESHOLD = 0.5

/** Minimum word-level similarity for the spoken phrase to count as a match. */
export const DEFAULT_PHRASE_THRESHOLD = 0.6

export interface VoiceProfile {
  /** Averaged, L2-normalized speaker embedding */
  embedding: number[]
  /** The wake phrase the user must speak (normalized). Empty = voice-only. */
  phrase: string
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
