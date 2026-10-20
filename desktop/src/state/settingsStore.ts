import { create } from 'zustand'

export interface SettingsState {
  setupCompleted: boolean

  permissions: {
    openApps: boolean
    closeApps: boolean
    cleanup: boolean
    files: boolean
    seeScreen: boolean
    screenShare: boolean
    clipboardSync: boolean
    remoteControl: boolean
    proactive: boolean
    systemControl: boolean
    alwaysListening: boolean
  }

  showWork: boolean

  localMode: boolean
  alwaysRespond: boolean

  setPermissions: (p: Partial<SettingsState['permissions']>) => void
  setShowWork: (on: boolean) => void
  setLocalMode: (on: boolean) => void
  setAlwaysRespond: (on: boolean) => void
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
  permissions: loadPermissions(),

  setupCompleted: loadSetupCompleted(),
  showWork: safe<boolean>('senti:showWork', true),
  localMode: safe<boolean>('senti:localMode', false),
  alwaysRespond: safe<boolean>('senti:alwaysRespond', false),

  setShowWork: (on) => {
    persist('senti:showWork', on)
    set({ showWork: on })
  },

  setLocalMode: (on: boolean) => {
    persist('senti:localMode', on)
    set({ localMode: on })
  },

  setAlwaysRespond: (on: boolean) => {
    persist('senti:alwaysRespond', on)
    set({ alwaysRespond: on })
  },

  setPermissions: (p) => {
    const next = { ...loadPermissions(), ...p }
    persist('senti:permissions', next)
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
