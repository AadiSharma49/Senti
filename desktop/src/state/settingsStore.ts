import { create } from 'zustand'

// Vite env defaults
const env = (import.meta as any)?.env || {}
const VITE_DEFAULT_USERNAME = env.VITE_DEFAULT_USERNAME || 'User'
const VITE_DEFAULT_TITLE = env.VITE_DEFAULT_TITLE || ''
const VITE_DEFAULT_PIN = env.VITE_DEFAULT_PIN || '1234'

export interface Identity {
  username: string
  preferredName: string
  preferredTitle: string
}

export interface SettingsState {
  identity: Identity
  displayTitle: string
  theme: 'auto' | 'dark' | 'light'
  animationsEnabled: boolean

  security: {
    maxAttempts: number
    lockoutDuration: number
    pin: string
  }

  unlockMethods: {
    pin: { enabled: boolean }
    voice: { enabled: boolean; configured: boolean; threshold: number; selectedDeviceId: string }
    clap: { enabled: boolean; configured: boolean }
  }

  setupCompleted: boolean
  // setters
  setIdentity: (id: Partial<Identity>) => void
  setDisplayTitle: (t: string) => void
  setTheme: (t: 'auto' | 'dark' | 'light') => void
  setAnimationsEnabled: (v: boolean) => void
  setSecurity: (s: Partial<SettingsState['security']>) => void
  setUnlockMethod: (method: string, value: any) => void
  setSetupCompleted: (completed: boolean) => void
  resetConfiguration: () => void
}

const safe = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const persist = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export const useSettingsStore = create<SettingsState>((set) => ({
  identity: safe('senti:identity', {
    username: VITE_DEFAULT_USERNAME,
    preferredName: VITE_DEFAULT_USERNAME,
    preferredTitle: VITE_DEFAULT_TITLE,
  }),

  displayTitle: safe('senti:displayTitle', VITE_DEFAULT_TITLE),
  theme: safe('senti:settings:theme', 'auto'),
  animationsEnabled: safe('senti:settings:animations', true),

  security: safe('senti:security', {
    maxAttempts: 3,
    lockoutDuration: 30,
    pin: VITE_DEFAULT_PIN,
  }),

  unlockMethods: safe('senti:settings:unlockMethods', {
    pin: { enabled: true },
    voice: { enabled: false, configured: false, threshold: 90, selectedDeviceId: '' },
    clap: { enabled: false, configured: false },
  }),

  setupCompleted: safe('senti:setupCompleted', false),

  setIdentity: (id) => {
    const next = { ...safe<Partial<Identity>>('senti:identity', {}), ...id } as Identity
    persist('senti:identity', next)
    set({ identity: next })
  },

  setDisplayTitle: (t) => {
    persist('senti:displayTitle', t)
    set({ displayTitle: t })
  },

  setTheme: (t) => {
    persist('senti:settings:theme', t)
    set({ theme: t })
  },

  setAnimationsEnabled: (v) => {
    persist('senti:settings:animations', v)
    set({ animationsEnabled: v })
  },

  setSecurity: (s) => {
    const curr = safe('senti:security', { maxAttempts: 3, lockoutDuration: 30, pin: VITE_DEFAULT_PIN })
    const next = { ...curr, ...s }
    persist('senti:security', next)
    set({ security: next })
  },

  setUnlockMethod: (method, value) => {
    try {
      const raw = localStorage.getItem('senti:settings:unlockMethods')
      const current = raw ? JSON.parse(raw) : {}
      const updated = { ...current, [method]: value }
      persist('senti:settings:unlockMethods', updated)
      set((s) => ({ unlockMethods: { ...s.unlockMethods, [method]: value } }))
    } catch {
      // ignore
    }
  },
  setSetupCompleted: (completed) => {
    persist('senti:setupCompleted', completed)
    set({ setupCompleted: completed })
  },
  resetConfiguration: () => {
    const defaultIdentity = {
      username: VITE_DEFAULT_USERNAME,
      preferredName: VITE_DEFAULT_USERNAME,
      preferredTitle: VITE_DEFAULT_TITLE,
    }
    const defaultSecurity = {
      maxAttempts: 3,
      lockoutDuration: 30,
      pin: VITE_DEFAULT_PIN,
    }

    try {
      localStorage.removeItem('senti:identity')
      localStorage.removeItem('senti:security')
      localStorage.removeItem('senti:settings:unlockMethods')
      localStorage.removeItem('senti:setupCompleted')
    } catch {
      // ignore storage errors
    }

    set({
      identity: defaultIdentity,
      security: defaultSecurity,
      unlockMethods: {
        pin: { enabled: true },
        voice: { enabled: false, configured: false, threshold: 90, selectedDeviceId: '' },
        clap: { enabled: false, configured: false },
      },
      setupCompleted: false,
    })
  },
}));
