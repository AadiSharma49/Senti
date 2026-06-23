import { create } from 'zustand'
import { useLockStore } from '../state/lockStore'

export type VoiceAuthState = 'idle' | 'listening' | 'verifying' | 'matched' | 'failed'

export interface VoiceAuthStore {
  state: VoiceAuthState
  startListening: () => void
  simulateVoiceSuccess: () => void
  simulateVoiceFail: () => void
  reset: () => void
}

export const useVoiceAuthStore = create<VoiceAuthStore>((set, get) => ({
  state: 'idle',

  startListening: () => {
    set({ state: 'listening' })
  },

  simulateVoiceSuccess: () => {
    set({ state: 'verifying' })
    setTimeout(() => {
      set({ state: 'matched' })
      useLockStore.getState().authSuccess()
      setTimeout(() => set({ state: 'idle' }), 300)
    }, 600)
  },

  simulateVoiceFail: () => {
    set({ state: 'verifying' })
    setTimeout(() => {
      set({ state: 'failed' })
      useLockStore.getState().authFail()
      setTimeout(() => set({ state: 'idle' }), 300)
    }, 600)
  },

  reset: () => set({ state: 'idle' }),
}))
