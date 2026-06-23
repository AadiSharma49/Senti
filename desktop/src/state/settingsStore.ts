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

export const useSettingsStore = create<SettingsState>((set) => ({
  security: safe('senti:security', {
    enabledMethods: ['voice', 'clap', 'pin'] as AuthMethod[],
    maxAttempts: 3,
    lockoutDuration: 30,
    pin: '1234',
  }),

  setupCompleted: safe('senti:setupCompleted', false),

  setSecurity: (s) => {
    const curr = safe('senti:security', { enabledMethods: ['voice', 'clap', 'pin'] as AuthMethod[], maxAttempts: 3, lockoutDuration: 30, pin: '1234' })
    const next = { ...curr, ...s }
    persist('senti:security', next)
    set({ security: next })
  },

  setSetupCompleted: (completed) => {
    persist('senti:setupCompleted', completed)
    set({ setupCompleted: completed })
  },

  resetConfiguration: () => {
    const defaultSecurity = {
      enabledMethods: ['voice', 'clap', 'pin'] as AuthMethod[],
      maxAttempts: 3,
      lockoutDuration: 30,
      pin: '1234',
    }

    try {
      localStorage.removeItem('senti:security')
      localStorage.removeItem('senti:setupCompleted')
    } catch {
      // ignore storage errors
    }

    set({
      security: defaultSecurity,
      setupCompleted: false,
    })
  },
}))