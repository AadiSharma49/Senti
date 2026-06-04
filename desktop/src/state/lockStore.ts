import { create } from 'zustand'
import { useSettingsStore } from './settingsStore'
import { audioManager } from '../services/audioManager'

let lockoutResetTimer: number | null = null

export type SessionState =
  | 'booting'
  | 'greeting'
  | 'locked'
  | 'typing_pin'
  | 'failed_attempt'
  | 'lockout'
  | 'unlocking'
  | 'unlocked'
  | 'idle'

export interface LockStore {
  state: SessionState
  failedAttempts: number
  isSpeaking: boolean
  lockoutUntil: number | null

  // session lifecycle
  startBoot: () => void
  startGreeting: () => void
  enterTyping: () => void
  setIdle: () => void

  // auth actions
  unlock: (enteredPin: string) => 'success' | 'failed'
  unlockWithClap: () => void
  unlockWithVoice: () => void
  lock: () => void

  // misc
  resetFailedAttempts: () => void
  setSpeaking: (speaking: boolean) => void
}

export const useLockStore = create<LockStore>((set, get) => ({
  state: 'booting',
  failedAttempts: 0,
  isSpeaking: false,
  lockoutUntil: null,

  startBoot: () => {
    set({ state: 'booting' })
  },

  startGreeting: () => {
    set({ state: 'greeting' })
  },

  enterTyping: () => {
    set({ state: 'typing_pin' })
  },

  setIdle: () => {
    set({ state: 'idle' })
  },

  unlock: (enteredPin: string) => {
    const settings = useSettingsStore.getState()
    const storedPin = settings?.security?.pin || (localStorage.getItem('senti:pin') as string) || '1234'
    const maxAttempts = settings?.security?.maxAttempts || 3
    const lockoutDuration = settings?.security?.lockoutDuration || 30

    if (get().state === 'lockout') {
      return 'failed'
    }

    if (enteredPin === storedPin) {
      console.log('[AUDIO] unlock (correct PIN)')
      if (lockoutResetTimer) {
        clearTimeout(lockoutResetTimer)
        lockoutResetTimer = null
      }
      try { audioManager.play('unlock') } catch {}
      set({ state: 'unlocking', failedAttempts: 0, lockoutUntil: null })
      setTimeout(() => set({ state: 'unlocked' }), 1100)
      return 'success'
    }

    const nextAttempts = get().failedAttempts + 1
    console.log('[AUDIO] denied (wrong PIN)')
    try { audioManager.play('denied') } catch {}

    if (nextAttempts >= maxAttempts) {
      setTimeout(() => {
        console.log('[AUDIO] crash (lockout)')
        try { audioManager.play('crash') } catch {}
      }, 450)
      const lockout = Date.now() + lockoutDuration * 1000
      set({ state: 'lockout', failedAttempts: nextAttempts, lockoutUntil: lockout })

      if (lockoutResetTimer) {
        clearTimeout(lockoutResetTimer)
      }
      lockoutResetTimer = window.setTimeout(() => {
        set({ failedAttempts: 0, lockoutUntil: null, state: 'locked' })
        lockoutResetTimer = null
      }, lockoutDuration * 1000)
    } else {
      set({ state: 'failed_attempt', failedAttempts: nextAttempts })
    }

    return 'failed'
  },

  unlockWithClap: () => {
    if (get().state === 'lockout') return
    if (lockoutResetTimer) {
      clearTimeout(lockoutResetTimer)
      lockoutResetTimer = null
    }
    console.log('[AUDIO] unlock (clap)')
    try { audioManager.play('unlock') } catch {}
    set({ state: 'unlocking', failedAttempts: 0, lockoutUntil: null })
    setTimeout(() => set({ state: 'unlocked' }), 1100)
  },

  unlockWithVoice: () => {
    if (get().state === 'lockout') return
    if (lockoutResetTimer) {
      clearTimeout(lockoutResetTimer)
      lockoutResetTimer = null
    }
    console.log('[AUDIO] unlock (voice)')
    try { audioManager.play('unlock') } catch {}
    set({ state: 'unlocking', failedAttempts: 0, lockoutUntil: null })
    setTimeout(() => set({ state: 'unlocked' }), 1100)
  },

  lock: () => {
    set({ state: 'locked', failedAttempts: 0 })
  },

  resetFailedAttempts: () => {
    set({ failedAttempts: 0, lockoutUntil: null })
  },

  setSpeaking: (speaking: boolean) => {
    set({ isSpeaking: speaking })
  },
}))