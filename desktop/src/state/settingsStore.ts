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
    /** Open your files and folders (read-only: opens them, never edits/deletes). */
    files: boolean
    /**
     * Let Senti take a screenshot and look at it — ONLY when you ask. There
     * is no background capture; nothing happens unless you say so.
     */
    seeScreen: boolean
    /** Stream this PC's screen to your own phone/laptop for a live remote view. */
    screenShare: boolean
    /** Sync the clipboard between your devices: copy here, paste there. */
    clipboardSync: boolean
    /**
     * Let another of YOUR devices take mouse/keyboard control of this one.
     * Off by default — and even on, nothing connects without the remote PIN.
     */
    remoteControl: boolean
    /**
     * Let Senti start conversations — notice what you're doing and say
     * something unprompted. It reads the foreground window's TITLE only, on
     * this machine; screen contents are never captured or sent.
     */
    proactive: boolean
    /** Volume and locking the workstation. */
    systemControl: boolean
  /**
   * Keep listening in the background for "Senti …" so you never open the app.
   * The listening is entirely on-device — audio is never uploaded, and only
   * the text of a command leaves after the wake word fires.
   */
  alwaysListening: boolean
}

/**
 * Local-only mode: no cloud APIs. All AI runs on this machine via Ollama
 * + Piper. Zero data leaves the PC. Requires Ollama + Piper to be installed.
 */
localMode: boolean

setLocalMode: (on: boolean) => void

setSecurity: (s: Partial<SettingsState['security']>) => void
  setPermissions: (p: Partial<SettingsState['permissions']>) => void
  /**
   * Carry out tasks ON SCREEN where you can watch, rather than silently.
   * Slower and it can be interrupted, but you see the work instead of being
   * told about it.
   */
  showWork: boolean

  setShowWork: (on: boolean) => void
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
  files: true,
  seeScreen: true,
  screenShare: true,
  clipboardSync: true,
  remoteControl: false,
  proactive: true,
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
  showWork: safe<boolean>('senti:showWork', true),
  localMode: safe<boolean>('senti:localMode', false),

  setShowWork: (on) => {
    persist('senti:showWork', on)
    set({ showWork: on })
  },

  setLocalMode: (on: boolean) => {
    persist('senti:localMode', on)
    set({ localMode: on })
  },

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