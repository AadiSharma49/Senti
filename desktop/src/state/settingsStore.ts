import { create } from 'zustand'

export interface SettingsState {
  setupCompleted: boolean

  permissions: {
    openApps: boolean
    closeApps: boolean
    cleanup: boolean
    files: boolean
    codeBridge: boolean
    seeScreen: boolean
    watchScreen: boolean
    screenShare: boolean
    clipboardSync: boolean
    remoteControl: boolean
    proactive: boolean
    systemControl: boolean
    alwaysListening: boolean
  }

  showWork: boolean

  setPermissions: (p: Partial<SettingsState['permissions']>) => void
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

const persist = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const loadSetupCompleted = (): boolean => {
  try {
    const fromMain = window.senti?.setupCompletedAtBoot
    if (typeof fromMain === 'boolean') return fromMain
  } catch {
    // not in Electron — fall through
  }
  return safe('senti:setupCompleted', false)
}

const PERMISSIONS_KEY = 'senti:permissions'
/**
 * Tracks an explicit opt-in to clipboard sync after it was changed to
 * default-off. Older builds persisted the entire `permissions` object whenever
 * ANY toggle changed, so a stored `clipboardSync: true` without this marker
 * reflects the old default rather than a deliberate choice.
 */
const CLIPBOARD_OPT_IN_KEY = 'senti:clipboardSyncOptIn'

export const DEFAULT_PERMISSIONS: SettingsState['permissions'] = {
  openApps: true,
  closeApps: false,
  cleanup: false,
  files: true,
  codeBridge: false,
  seeScreen: true,
  watchScreen: false,
  screenShare: true,
  clipboardSync: false,
  remoteControl: false,
  proactive: true,
  systemControl: true,
  alwaysListening: true,
}

export const loadPermissions = (): SettingsState['permissions'] => {
  const stored = safe<Partial<SettingsState['permissions']>>(PERMISSIONS_KEY, {})
  const merged: SettingsState['permissions'] = {
    ...DEFAULT_PERMISSIONS,
    ...stored,
  }

  // Require explicit opt-in for clipboard sync so upgraded installs that only
  // inherited the old `true` default do not keep uploading copied text.
  let optedIn = false
  try {
    optedIn = localStorage.getItem(CLIPBOARD_OPT_IN_KEY) === '1'
  } catch {
    optedIn = false
  }
  if (merged.clipboardSync && !optedIn) {
    merged.clipboardSync = false
    if (stored.clipboardSync === true) {
      persist(PERMISSIONS_KEY, merged)
    }
  }

  return merged
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  permissions: loadPermissions(),

  setupCompleted: loadSetupCompleted(),
  showWork: safe<boolean>('senti:showWork', true),

  setShowWork: (on) => {
    persist('senti:showWork', on)
    set({ showWork: on })
  },

  setPermissions: (p) => {
    const next = { ...get().permissions, ...p }
    if ('clipboardSync' in p) {
      try {
        if (p.clipboardSync) localStorage.setItem(CLIPBOARD_OPT_IN_KEY, '1')
        else localStorage.removeItem(CLIPBOARD_OPT_IN_KEY)
      } catch {}
    }
    persist(PERMISSIONS_KEY, next)
    set({ permissions: next })
  },

  setSetupCompleted: (completed) => {
    persist('senti:setupCompleted', completed)
    try {
      void window.senti?.persistSetupCompleted?.(completed)
    } catch {}
    set({ setupCompleted: completed })
  },

  resetConfiguration: () => {
    try {
      localStorage.removeItem('senti:setupCompleted')
    } catch {
      // ignore storage errors
    }
    try {
      void window.senti?.persistSetupCompleted?.(false)
    } catch {}

    set({
      setupCompleted: false,
    })
  },
}))
