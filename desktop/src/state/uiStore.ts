import { create } from 'zustand'

export interface UiStore {
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  toggleSettings: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
}))
