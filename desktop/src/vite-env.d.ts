/// <reference types="vite/client" />

export interface ApiRequest {
  baseUrl: string
  path: string
  method?: string
  body?: unknown
  /** Attach the device token (default true). */
  auth?: boolean
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

interface SentiAPI {
  platform: () => Promise<string>
  deviceInfo: () => Promise<{ hostname: string; platform: string }>
  lock: () => Promise<void>
  quit: () => Promise<boolean>
  setLockState: (locked: boolean) => Promise<void>
  /** True while first-time setup is showing: a normal window, not a lock. */
  setSetupMode: (inSetup: boolean) => Promise<boolean>
  /** 'lock' fullscreen, 'setup' normal window, 'hud' small + hidden in tray. */
  setWindowMode: (mode: 'lock' | 'setup' | 'hud') => Promise<boolean>
  hudShow: () => Promise<boolean>
  hudHide: () => Promise<boolean>
  /** Setup-completion flag read from a file at boot (survives port changes). */
  setupCompletedAtBoot: boolean
  persistSetupCompleted: (done: boolean) => Promise<boolean>
  /** Real vitals for this machine (memory, disk, top processes, startup apps). */
  systemInfo: () => Promise<SystemSnapshot>
  /** OS actions (whitelisted or scoped in main). */
  openApp: (name: string) => Promise<{ ok: boolean; label?: string; error?: string }>
  closeApp: (name: string) => Promise<{ ok: boolean; label?: string; error?: string }>
  cleanTemp: () => Promise<{ freedMB: number; files: number }>
  lockWorkstation: () => Promise<boolean>
  volume: (direction: 'up' | 'down' | 'mute') => Promise<boolean>

  /** Call the backend from the main process (token attached there). */
  api: <T = unknown>(req: ApiRequest) => Promise<ApiResponse<T>>
  /** Store the pairing token (encrypted by the OS keystore, in main). */
  tokenSet: (token: string) => Promise<boolean>
  tokenClear: () => Promise<boolean>
  /** Whether this device is linked. There is no way to READ the token. */
  tokenPresent: () => Promise<boolean>
}

export interface SystemSnapshot {
  os: string
  cpu: string
  cores: number
  ramTotalGB: number
  ramUsedGB: number
  ramUsedPct: number
  uptimeHours: number
  disks?: { drive: string; totalGB: number; freeGB: number; usedPct: number }[]
  topProcesses?: { name: string; memMB: number }[]
  startupApps?: number
}

declare global {
  interface Window {
    senti: SentiAPI
  }
}

export {}
