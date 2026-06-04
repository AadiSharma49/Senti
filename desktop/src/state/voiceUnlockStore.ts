import { create } from 'zustand'
import { useSettingsStore } from './settingsStore'
import { VoiceProfile, VoicePhrase } from '../types/unlockProfiles'

const STORAGE_KEY = 'senti:voiceProfile'

const loadVoiceProfile = (): VoiceProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as VoiceProfile
  } catch (e) {
    console.warn('[VoiceStore] Failed to load voice profile:', e)
  }
  return {
    trained: false,
    lastTrained: null,
    phrases: [],
    primaryPhrase: null,
    version: 1,
  }
}

const saveVoiceProfile = (profile: VoiceProfile) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch (e) {
    console.error('[VoiceStore] Failed to save voice profile:', e)
  }
}

export interface VoiceUnlockStore {
  profile: VoiceProfile

  // Training
  startTraining: () => void
  recordPhrase: (phrase: VoicePhrase) => void
  confirmPhrase: (phraseIndex: number) => void
  completeTraining: () => void
  updatePrimaryPhrase: (phrase: string) => void

  // Profile management
  resetProfile: () => void
  getStatus: () => 'not-configured' | 'trained' | 'needs-retrain'
  getLastTrainedDate: () => Date | null
  getPrimaryPhrase: () => string | null
}

export const useVoiceUnlockStore = create<VoiceUnlockStore>((set, get) => ({
  profile: loadVoiceProfile(),

  startTraining: () => {
    // Reset phrases for new training session
    set((state) => ({
      profile: {
        ...state.profile,
        phrases: [],
        primaryPhrase: null,
      },
    }))
  },

  recordPhrase: (phrase: VoicePhrase) => {
    set((state) => ({
      profile: {
        ...state.profile,
        phrases: [...state.profile.phrases, phrase],
      },
    }))
  },

  confirmPhrase: (phraseIndex: number) => {
    const phrase = get().profile.phrases[phraseIndex]
    if (!phrase) return

    const updated = {
      ...get().profile,
      primaryPhrase: phrase,
    }
    set({ profile: updated })
    saveVoiceProfile(updated)
  },

  completeTraining: () => {
    const profile = get().profile
    if (!profile.primaryPhrase) return

    const updated = {
      ...profile,
      trained: true,
      lastTrained: Date.now(),
    }
    set({ profile: updated })
    saveVoiceProfile(updated)
    const settings = useSettingsStore.getState()
    settings.setUnlockMethod('voice', {
      ...settings.unlockMethods.voice,
      enabled: true,
      configured: true,
    })
  },

  resetProfile: () => {
    const defaultProfile: VoiceProfile = {
      trained: false,
      lastTrained: null,
      phrases: [],
      primaryPhrase: null,
      version: 1,
    }
    set({ profile: defaultProfile })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('[VoiceStore] Failed to reset profile:', e)
    }
  },
  updatePrimaryPhrase: (phrase: string) => {
    const updated = {
      ...get().profile,
      primaryPhrase: {
        phrase,
        recordedAt: Date.now(),
        duration: 0,
        metadata: { quality: 'good' as const },
      },
    }
    set({ profile: updated })
    saveVoiceProfile(updated)
  },

  getStatus: () => {
    const profile = get().profile
    if (!profile.trained) return 'not-configured'
    if (!profile.primaryPhrase) return 'needs-retrain'
    return 'trained'
  },

  getLastTrainedDate: () => {
    const lastTrained = get().profile.lastTrained
    return lastTrained ? new Date(lastTrained) : null
  },

  getPrimaryPhrase: () => {
    return get().profile.primaryPhrase?.phrase || null
  },
}))
