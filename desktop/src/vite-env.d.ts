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
  /** 'signin' normal window (once at start), 'setup' first run, 'hud' tray. */
  setWindowMode: (mode: 'signin' | 'setup' | 'hud' | 'panel') => Promise<boolean>
  hudShow: () => Promise<boolean>
  hudHide: () => Promise<boolean>
  /** Fired from the tray / second launch to open Settings. Returns unsubscribe. */
  onOpenSettings: (cb: () => void) => () => void
  /** Tap-to-talk hotkey pressed — open a conversation. Returns unsubscribe. */
  onTalk: (cb: () => void) => () => void
  /** Setup-completion flag read from a file at boot (survives port changes). */
  setupCompletedAtBoot: boolean
  persistSetupCompleted: (done: boolean) => Promise<boolean>
  /** Real vitals for this machine (memory, disk, top processes, startup apps). */
  systemInfo: () => Promise<SystemSnapshot>
  /** Desktop capture source ids for the live remote screen view. */
  screenSources: () => Promise<{ id: string; name: string }[]>
  /** OS clipboard (text only), for cross-device clipboard sync. */
  clipboardRead: () => Promise<string>
  clipboardWrite: (text: string) => Promise<boolean>
  /** Hold the machine awake while a monitored task runs. */
  /** `holder` is a caller id — the lock is ref-counted so independent callers (a
   * running task, screen share) don't turn off each other's hold on it. */
  keepAwake: (on: boolean, holder: string) => Promise<boolean>
  /** OS actions (whitelisted or scoped in main). */
  openApp: (name: string) => Promise<{ ok: boolean; label?: string; error?: string }>
  closeApp: (name: string) => Promise<{ ok: boolean; label?: string; error?: string }>
  cleanTemp: () => Promise<{ freedMB: number; files: number }>
  emptyRecycleBin: () => Promise<{ freedMB: number; files: number }>
  openFolder: (name: string) => Promise<{ ok: boolean; label?: string; error?: string }>
  openFile: (query: string) => Promise<{ ok: boolean; label?: string; count?: number; error?: string }>
  webSearch: (query: string) => Promise<{ ok: boolean }>
  lockWorkstation: () => Promise<boolean>
  power: (mode: string) => Promise<boolean>
  /** The foreground window's title + process, so Senti can speak up about it. */
  activeWindow: () => Promise<{ title: string; process: string } | null>
  /** Apply input from the machine remotely driving this one. */
  remoteInput: (events: unknown[]) => Promise<boolean>
  remoteInputStop: () => Promise<boolean>
  volume: (direction: 'up' | 'down' | 'mute') => Promise<boolean>

  /** Call the backend from the main process (token attached there). */
  api: <T = unknown>(req: ApiRequest) => Promise<ApiResponse<T>>
  /** Store the pairing token (encrypted by the OS keystore, in main). */
  tokenSet: (token: string) => Promise<boolean>
  tokenClear: () => Promise<boolean>
  /** Whether this device is linked. There is no way to READ the token. */
  tokenPresent: () => Promise<boolean>

  /** Senti's memory — facts it keeps about you. Local file, never uploaded. */
  memoryList: () => Promise<SentiMemory[]>
  memoryAdd: (text: string) => Promise<SentiMemory[]>
  memoryForget: (id: string) => Promise<SentiMemory[]>
  memoryClear: () => Promise<SentiMemory[]>
}

export interface SentiMemory {
  id: string
  text: string
  createdAt: number
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
