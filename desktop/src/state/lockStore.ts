import { create } from 'zustand'
import { useSettingsStore } from './settingsStore'
import { audioManager } from '../services/audioManager'
import type { LockStore, SessionState, AuthMethod } from '../types/auth'

let lockoutResetTimer: number | null = null

export const useLockStore = create<LockStore>((set, get) => ({
  state: 'booting',
  currentAuthMethod: null,
  failedAttempts: 0,
  lockoutUntil: null,

  startBoot: () => set({ state: 'booting' }),

  lock: () => set({ state: 'locked', currentAuthMethod: null, failedAttempts: 0, lockoutUntil: null }),

  startVoiceAttempt: () => {
    const settings = useSettingsStore.getState()
    if (settings.security.enabledMethods.includes('voice')) {
      set({ state: 'listening_voice', currentAuthMethod: 'voice' })
    }
  },

  startClapAttempt: () => {
    const settings = useSettingsStore.getState()
    if (settings.security.enabledMethods.includes('clap')) {
      set({ state: 'listening_clap', currentAuthMethod: 'clap' })
    }
  },

  enterPinEntry: () => {
    set({ state: 'pin_entry', currentAuthMethod: 'pin' })
  },

  verifyPin: (pin: string) => {
    const settings = useSettingsStore.getState()
    const storedPin = settings.security.pin || '1234'
    return pin === storedPin
  },

  authSuccess: () => {
    if (lockoutResetTimer) { clearTimeout(lockoutResetTimer); lockoutResetTimer = null }
    set({ state: 'unlocked', failedAttempts: 0, lockoutUntil: null, currentAuthMethod: null })
  },

  authFail: () => {
    const settings = useSettingsStore.getState()
    const maxAttempts = settings.security.maxAttempts || 3
    const lockoutDuration = settings.security.lockoutDuration || 30
    const nextAttempts = get().failedAttempts + 1

    if (nextAttempts >= maxAttempts) {
      const lockout = Date.now() + lockoutDuration * 1000
      set({ state: 'lockout', failedAttempts: nextAttempts, lockoutUntil: lockout })
      audioManager.play('crash')
      if (lockoutResetTimer) clearTimeout(lockoutResetTimer)
      lockoutResetTimer = window.setTimeout(() => {
        set({ failedAttempts: 0, lockoutUntil: null, state: 'locked' })
        lockoutResetTimer = null
      }, lockoutDuration * 1000)
    } else {
      set({ state: 'failed', failedAttempts: nextAttempts })
    }
  },

  resetFailedAttempts: () => set({ failedAttempts: 0, lockoutUntil: null }),
}))