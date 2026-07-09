import { create } from 'zustand'
import { fetchGreeting, say, deviceLang } from '../services/greetingService'

/**
 * greetingStore - holds the current unlock greeting so the lock screen can
 * display it while it's spoken aloud (human voice if available, else TTS).
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
    const lang = deviceLang()
    const greeting = await fetchGreeting(lang)
    set({ text: greeting.text, speaking: true })
    await say(greeting, lang)
    set({ speaking: false })
  },
  reset: () => set({ text: '', speaking: false }),
}))
