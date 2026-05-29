import { create } from 'zustand'
import { useSettingsStore } from './settingsStore'
import { audioManager } from '../services/audioManager'

export type SessionState =
  | 'booting'
  | 'greeting'
  | 'locked'
  | 'typing_pin'
  | 'failed_attempt'
  | 'unlocking'
  | 'unlocked'
  | 'idle'

export interface LockStore {
  state: SessionState
  failedAttempts: number
  isSpeaking: boolean
  cooldownUntil: number | null

  // session lifecycle
  startBoot: () => void
  startGreeting: () => void
  enterTyping: () => void
  setIdle: () => void

  // auth actions
  unlock: (enteredPin: string) => 'success' | 'failed'
  lock: () => void

  // misc
  resetFailedAttempts: () => void
  setSpeaking: (speaking: boolean) => void
}

export const useLockStore = create<LockStore>((set, get) => ({
  state: 'booting',
  failedAttempts: 0,
  isSpeaking: false,
  cooldownUntil: null,

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
    if (enteredPin === storedPin) {
      try { audioManager.play('unlock') } catch {}
      set({ state: 'unlocking', failedAttempts: 0 })
      setTimeout(() => set({ state: 'unlocked' }), 900)
      return 'success'
    }

    // incorrect
    const nextAttempts = get().failedAttempts + 1
    // always play denied for each failed attempt
    try { audioManager.play('denied') } catch {}

    if (nextAttempts >= 3) {
      // play crash shortly after denied
      setTimeout(() => { try { audioManager.play('crash') } catch {} }, 400)
      const cooldownSeconds = settings?.security?.cooldownSeconds || 30
      const cooldown = Date.now() + cooldownSeconds * 1000
      set({ state: 'failed_attempt', failedAttempts: nextAttempts, cooldownUntil: cooldown })

      // schedule reset after cooldown
      setTimeout(() => {
        set({ failedAttempts: 0, cooldownUntil: null, state: 'locked' })
      }, cooldownSeconds * 1000)
    } else {
      set({ state: 'failed_attempt', failedAttempts: nextAttempts })
    }

    return 'failed'
  },

  lock: () => {
    set({ state: 'locked', failedAttempts: 0 })
  },

  resetFailedAttempts: () => {
    set({ failedAttempts: 0, cooldownUntil: null })
  },

  setSpeaking: (speaking: boolean) => {
    set({ isSpeaking: speaking })
  },
}))
