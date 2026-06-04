import { create } from 'zustand'
import { useSettingsStore } from './settingsStore'
import { ClapProfile, ClapPattern } from '../types/unlockProfiles'

const STORAGE_KEY = 'senti:clapProfile'

const loadClapProfile = (): ClapProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ClapProfile
  } catch (e) {
    console.warn('[ClapStore] Failed to load clap profile:', e)
  }
  return {
    trained: false,
    lastTrained: null,
    patterns: [],
    primaryPattern: null,
    version: 1,
  }
}

const saveClapProfile = (profile: ClapProfile) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch (e) {
    console.error('[ClapStore] Failed to save clap profile:', e)
  }
}

export interface ClapUnlockStore {
  profile: ClapProfile

  // Training
  startTraining: () => void
  recordPattern: (pattern: ClapPattern) => void
  confirmPattern: (patternIndex: number) => void
  completeTraining: () => void

  // Profile management
  resetProfile: () => void
  getStatus: () => 'not-configured' | 'trained' | 'needs-retrain'
  getLastTrainedDate: () => Date | null
}

export const useClapUnlockStore = create<ClapUnlockStore>((set, get) => ({
  profile: loadClapProfile(),

  startTraining: () => {
    // Reset patterns for new training session
    set((state) => ({
      profile: {
        ...state.profile,
        patterns: [],
        primaryPattern: null,
      },
    }))
  },

  recordPattern: (pattern: ClapPattern) => {
    set((state) => ({
      profile: {
        ...state.profile,
        patterns: [...state.profile.patterns, pattern],
      },
    }))
  },

  confirmPattern: (patternIndex: number) => {
    const pattern = get().profile.patterns[patternIndex]
    if (!pattern) return

    const updated = {
      ...get().profile,
      primaryPattern: pattern,
    }
    set({ profile: updated })
    saveClapProfile(updated)
  },

  completeTraining: () => {
    const profile = get().profile
    if (!profile.primaryPattern) return

    const updated = {
      ...profile,
      trained: true,
      lastTrained: Date.now(),
    }
    set({ profile: updated })
    saveClapProfile(updated)
    const settings = useSettingsStore.getState()
    settings.setUnlockMethod('clap', {
      ...settings.unlockMethods.clap,
      enabled: true,
      configured: true,
    })
  },

  resetProfile: () => {
    const defaultProfile: ClapProfile = {
      trained: false,
      lastTrained: null,
      patterns: [],
      primaryPattern: null,
      version: 1,
    }
    set({ profile: defaultProfile })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('[ClapStore] Failed to reset profile:', e)
    }
  },

  getStatus: () => {
    const profile = get().profile
    if (!profile.trained) return 'not-configured'
    if (!profile.primaryPattern) return 'needs-retrain'
    return 'trained'
  },

  getLastTrainedDate: () => {
    const lastTrained = get().profile.lastTrained
    return lastTrained ? new Date(lastTrained) : null
  },
}))
