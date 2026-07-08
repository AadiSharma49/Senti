import { create } from 'zustand'
import { fetchGreeting, speak } from '../services/greetingService'

/**
 * greetingStore - holds the current unlock greeting so the lock screen can
 * display it while it's spoken aloud.
 */
export interface GreetingStore {
  text: string
  speaking: boolean
  /** Fetch + speak the greeting. Resolves when speech finishes. */
  greet: () => Promise<void>
  reset: () => void
}

export const useGreetingStore = create<GreetingStore>((set) => ({
  text: '',
  speaking: false,
  greet: async () => {
    const text = await fetchGreeting()
    set({ text, speaking: true })
    await speak(text)
    set({ speaking: false })
  },
  reset: () => set({ text: '', speaking: false }),
}))
