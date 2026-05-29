import { create, SetState } from 'zustand'

/**
 * Simple theme store – currently only tracks dark/light mode.
 * Future extensions can add accent colors, adaptive wallpaper extraction, etc.
 */
export interface ThemeState {
  mode: 'dark' | 'light'
  toggle: () => void
  setMode: (mode: 'dark' | 'light') => void
}

export const useThemeStore = create<ThemeState>((set: SetState<ThemeState>) => ({
  mode: 'dark',
  toggle: () => set((state) => ({ mode: state.mode === 'dark' ? 'light' : 'dark' })),
  setMode: (mode) => set({ mode }),
}))

