import { create } from 'zustand'
import type { AuthMethod } from '../types/auth'

export interface SettingsState {
  security: {
    enabledMethods: AuthMethod[]
    maxAttempts: number
    lockoutDuration: number
    pin: string
  }

  setupCompleted: boolean

  setSecurity: (s: Partial<SettingsState['security']>) => void
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

const DEFAULT_SECURITY: SettingsState['security'] = {
  enabledMethods: ['voice', 'clap', 'pin'],
  maxAttempts: 3,
  lockoutDuration: 30,
  pin: '1234',
}

// Merge with defaults so configs saved by older versions (missing newer
// fields like enabledMethods) can never produce undefined properties.
const loadSecurity = (): SettingsState['security'] => ({
  ...DEFAULT_SECURITY,
  ...safe<Partial<SettingsState['security']>>('senti:security', {}),
})

// Setup flag: prefer the file-backed value from Electron main (origin-
// independent — survives a local-server port change), fall back to
// localStorage in dev/browser.
const loadSetupCompleted = (): boolean => {
  try {
    const fromMain = window.senti?.setupCompletedAtBoot
    if (typeof fromMain === 'boolean') return fromMain
  } catch {
    // not in Electron — fall through
  }
  return safe('senti:setupCompleted', false)
}

export const useSettingsStore = create<SettingsState>((set) => ({
  security: loadSecurity(),

  setupCompleted: loadSetupCompleted(),

  setSecurity: (s) => {
    const next = { ...loadSecurity(), ...s }
    persist('senti:security', next)
    set({ security: next })
  },

  setSetupCompleted: (completed) => {
    persist('senti:setupCompleted', completed)
    // Also persist to the file in main, so it survives an origin change.
    try {
      void window.senti?.persistSetupCompleted?.(completed)
    } catch {}
    set({ setupCompleted: completed })
  },

  resetConfiguration: () => {
    const defaultSecurity = { ...DEFAULT_SECURITY }

    try {
      localStorage.removeItem('senti:security')
      localStorage.removeItem('senti:setupCompleted')
    } catch {
      // ignore storage errors
    }
    // Clear the file-backed flag too, so a reset really re-runs setup.
    try {
      void window.senti?.persistSetupCompleted?.(false)
    } catch {}

    set({
      security: defaultSecurity,
      setupCompleted: false,
    })
  },
}))