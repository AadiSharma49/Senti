import { create } from 'zustand'
import { isLinked, saveToken, clearToken } from '../services/api'

/**
 * deviceStore — whether this machine is linked to a Senti account.
 *
 * It deliberately does NOT hold the pairing token. That token is a bearer
 * credential for the account's device API; it used to sit in localStorage where
 * any renderer script or an open DevTools could lift it. It now lives only in
 * the Electron main process, encrypted by the OS keystore, and the renderer can
 * never read it back — it can only ask whether one exists.
 */
export interface DeviceStore {
  linked: boolean
  /** True until we've asked main whether a token exists. */
  loading: boolean

  refresh: () => Promise<void>
  /** Store a pairing token. Returns false if the OS keystore refused it. */
  link: (token: string) => Promise<boolean>
  unlink: () => Promise<void>
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  linked: false,
  loading: true,

  refresh: async () => {
    const linked = await isLinked()
    set({ linked, loading: false })
  },

  link: async (token) => {
    const ok = await saveToken(token.trim())
    set({ linked: ok })
    return ok
  },

  unlink: async () => {
    await clearToken()
    set({ linked: false })
  },
}))

// Ask main once at startup.
void useDeviceStore.getState().refresh()
