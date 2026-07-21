import { create } from 'zustand'
import type { AuthMethod } from '../types/auth'

export interface SettingsState {
  security: {
    enabledMethods: AuthMethod[]
    maxAttempts: number
    lockoutDuration: number
    pin: string
  }

  setupCompleted: boolean

  /**
   * The permission dial. Senti only ever does what you have switched on — an
   * AI with access to your PC is frightening; an AI with exactly the access you
   * granted is not.
   */
  permissions: {
    /** Open apps and websites. */
    openApps: boolean
    /** Close running apps. */
    closeApps: boolean
    /** Delete temp files to free disk space. */
    cleanup: boolean
    /** Volume and locking the workstation. */
    systemControl: boolean
    /**
     * Keep listening in the background for "Senti …" so you never open the app.
     * The listening is entirely on-device — audio is never uploaded, and only
     * the text of a command leaves after the wake word fires.
     */
    alwaysListening: boolean
  }

  setSecurity: (s: Partial<SettingsState['security']>) => void
  setPermissions: (p: Partial<SettingsState['permissions']>) => void
  setSetupCompleted: (completed: boolean) => void
  resetConfiguration: () => void
}

const safe = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const persist = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const DEFAULT_SECURITY: SettingsState['security'] = {
  enabledMethods: ['voice', 'clap', 'pin'],
  maxAttempts: 3,
  lockoutDuration: 30,
  pin: '1234',
}

// Merge with defaults so configs saved by older versions (missing newer
// fields like enabledMethods) can never produce undefined properties.
const loadSecurity = (): SettingsState['security'] => ({
  ...DEFAULT_SECURITY,
  ...safe<Partial<SettingsState['security']>>('senti:security', {}),
})

// Setup flag: prefer the file-backed value from Electron main (origin-
// independent — survives a local-server port change), fall back to
// localStorage in dev/browser.
const loadSetupCompleted = (): boolean => {
  try {
    const fromMain = window.senti?.setupCompletedAtBoot
    if (typeof fromMain === 'boolean') return fromMain
  } catch {
    // not in Electron — fall through
  }
  return safe('senti:setupCompleted', false)
}

// Opening things and volume are harmless; deleting files and killing apps are
// the ones a user should switch on deliberately.
const DEFAULT_PERMISSIONS: SettingsState['permissions'] = {
  openApps: true,
  closeApps: false,
  cleanup: false,
  systemControl: true,
  alwaysListening: true,
}

const loadPermissions = (): SettingsState['permissions'] => ({
  ...DEFAULT_PERMISSIONS,
  ...safe<Partial<SettingsState['permissions']>>('senti:permissions', {}),
})

export const useSettingsStore = create<SettingsState>((set) => ({
  security: loadSecurity(),
  permissions: loadPermissions(),

  setupCompleted: loadSetupCompleted(),

  setSecurity: (s) => {
    const next = { ...loadSecurity(), ...s }
    persist('senti:security', next)
    set({ security: next })
  },

  setPermissions: (p) => {
    const next = { ...loadPermissions(), ...p }
    persist('senti:permissions', next)
    set({ permissions: next })
  },

  setSetupCompleted: (completed) => {
    persist('senti:setupCompleted', completed)
    // Also persist to the file in main, so it survives an origin change.
    try {
      void window.senti?.persistSetupCompleted?.(completed)
    } catch {}
    set({ setupCompleted: completed })
  },

  resetConfiguration: () => {
    const defaultSecurity = { ...DEFAULT_SECURITY }

    try {
      localStorage.removeItem('senti:security')
      localStorage.removeItem('senti:setupCompleted')
    } catch {
      // ignore storage errors
    }
    // Clear the file-backed flag too, so a reset really re-runs setup.
    try {
      void window.senti?.persistSetupCompleted?.(false)
    } catch {}

    set({
      security: defaultSecurity,
      setupCompleted: false,
    })
  },
}))