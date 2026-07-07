import { create } from 'zustand'

/**
 * deviceStore - holds the pairing token that links this device to a Senti
 * account. Persisted locally; used by policySync to pull this account's
 * policy from the dashboard.
 */
const TOKEN_KEY = 'senti:deviceToken'

const load = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export interface DeviceStore {
  token: string | null
  setToken: (token: string) => void
  clearToken: () => void
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  token: load(),
  setToken: (token) => {
    const t = token.trim()
    try {
      localStorage.setItem(TOKEN_KEY, t)
    } catch {}
    set({ token: t })
  },
  clearToken: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {}
    set({ token: null })
  },
}))
