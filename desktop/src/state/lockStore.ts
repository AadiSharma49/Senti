import { create } from 'zustand'
import { useSettingsStore } from './settingsStore'

let lockoutResetTimer: number | null = null

export type SessionState =
  | 'booting'
  | 'locked'
  | 'typing_pin'
  | 'failed_attempt'
  | 'lockout'
  | 'unlocking'
  | 'unlocked'

export interface LockStore {
  state: SessionState
  failedAttempts: number
  lockoutUntil: number | null

  startBoot: () => void
  enterTyping: () => void
  lock: () => void

  unlock: (enteredPin: string) => 'success' | 'failed'
  resetFailedAttempts: () => void
}

export const useLockStore = create<LockStore>((set, get) => ({
  state: 'booting',
  failedAttempts: 0,
  lockoutUntil: null,

  startBoot: () => set({ state: 'booting' }),

  enterTyping: () => set({ state: 'typing_pin' }),

  unlock: (enteredPin: string) => {
    const settings = useSettingsStore.getState()
    const storedPin = settings?.security?.pin || '1234'
    const maxAttempts = settings?.security?.maxAttempts || 3
    const lockoutDuration = settings?.security?.lockoutDuration || 30

    if (get().state === 'lockout') return 'failed'

    if (enteredPin === storedPin) {
      if (lockoutResetTimer) { clearTimeout(lockoutResetTimer); lockoutResetTimer = null }
      set({ state: 'unlocking', failedAttempts: 0, lockoutUntil: null })
      setTimeout(() => set({ state: 'unlocked' }), 1100)
      return 'success'
    }

    const nextAttempts = get().failedAttempts + 1
    if (nextAttempts >= maxAttempts) {
      const lockout = Date.now() + lockoutDuration * 1000
      set({ state: 'lockout', failedAttempts: nextAttempts, lockoutUntil: lockout })
      if (lockoutResetTimer) clearTimeout(lockoutResetTimer)
      lockoutResetTimer = window.setTimeout(() => {
        set({ failedAttempts: 0, lockoutUntil: null, state: 'locked' })
        lockoutResetTimer = null
      }, lockoutDuration * 1000)
    } else {
      set({ state: 'failed_attempt', failedAttempts: nextAttempts })
    }
    return 'failed'
  },

  lock: () => set({ state: 'locked', failedAttempts: 0 }),
  resetFailedAttempts: () => set({ failedAttempts: 0, lockoutUntil: null }),
}))