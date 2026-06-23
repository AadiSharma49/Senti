import { create } from 'zustand'
import { useLockStore } from '../state/lockStore'

export type ClapAuthState = 'idle' | 'listening' | 'verifying' | 'matched' | 'failed'

export interface ClapAuthStore {
  state: ClapAuthState
  startListening: () => void
  simulateClapSuccess: () => void
  simulateClapFail: () => void
  reset: () => void
}

export const useClapAuthStore = create<ClapAuthStore>((set, get) => ({
  state: 'idle',

  startListening: () => {
    set({ state: 'listening' })
  },

  simulateClapSuccess: () => {
    set({ state: 'verifying' })
    setTimeout(() => {
      set({ state: 'matched' })
      useLockStore.getState().authSuccess()
      setTimeout(() => set({ state: 'idle' }), 300)
    }, 600)
  },

  simulateClapFail: () => {
    set({ state: 'verifying' })
    setTimeout(() => {
      set({ state: 'failed' })
      useLockStore.getState().authFail()
      setTimeout(() => set({ state: 'idle' }), 300)
    }, 600)
  },

  reset: () => set({ state: 'idle' }),
}))
