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

interface SentinelAPI {
  platform: () => Promise<string>
  deviceInfo: () => Promise<{ hostname: string; platform: string }>
  /** A fingerprint of the physical machine (survives reinstall) — used to stop one PC being linked to two different accounts. */
  hardwareId: () => Promise<string>
  quit: () => Promise<boolean>
  /** 'setup' first run, 'panel' control center, 'hud' the floating orb. */
  setWindowMode: (mode: 'setup' | 'hud' | 'panel') => Promise<boolean>
  /** Fill the display while driving another machine, and give it back after. */
  enterFullscreen: () => Promise<boolean>
  exitFullscreen: () => Promise<boolean>
  /** Show the HUD (big orb) while Sentinel is being spoken to. */
  hudShow: () => Promise<boolean>
  /** Shrink back to the small corner presence. */
  hudHide: () => Promise<boolean>
  /** Fully hide the Sentinel window — it keeps listening in the background. */
  hideWindow: () => Promise<boolean>
  /** Restore the Sentinel window to HUD mode after it was hidden. */
  restoreWindow: () => Promise<boolean>
  /** Start/stop the background screen watcher. */
  startScreenContext: () => Promise<boolean>
  stopScreenContext: () => Promise<boolean>
  /** Code bridge: VS Code ↔ Sentinel via WebSocket. */
  startCodeBridge: () => Promise<boolean>
  stopCodeBridge: () => Promise<boolean>
  sendToVSCode: (msg: unknown) => Promise<boolean>
  isCodeBridgeConnected: () => Promise<boolean>
  /** Listen for messages from the VS Code extension. */
  onCodeBridgeMessage: (cb: (msg: unknown) => void) => () => void
  /** Fired from the tray / second launch to open Settings. Returns unsubscribe. */
  onOpenSettings: (cb: () => void) => () => void
  /** Tap-to-talk hotkey pressed — open a conversation. Returns unsubscribe. */
  onTalk: (cb: () => void) => () => void
  /** Setup-completion flag read from a file at boot (survives port changes). */
  setupCompletedAtBoot: boolean
  persistSetupCompleted: (done: boolean) => Promise<boolean>
  /** Real vitals for this machine (memory, disk, top processes, startup apps). */
  systemInfo: () => Promise<SystemSnapshot>
  /** Screenshots — only ever taken because you asked for one. */
  screenshotSave: () => Promise<{ ok: boolean; path?: string }>
  screenshotGrab: () => Promise<string | null>
  /** Desktop capture source ids for the live remote screen view. */
  screenSources: () => Promise<{ id: string; name: string; displayId: string; selected: boolean }[]>
  /** Switch which monitor gets shared/controlled (takes effect on the next session). */
  setScreenSource: (displayId: string) => Promise<boolean>
  /** OS clipboard (text only), for cross-device clipboard sync. */
  clipboardRead: () => Promise<string>
  clipboardWrite: (text: string) => Promise<boolean>
  /** Hold the machine awake while a monitored task runs. */
  /** `holder` is a caller id — the lock is ref-counted so independent callers (a
   * running task, screen share) don't turn off each other's hold on it. */
  keepAwake: (on: boolean, holder: string) => Promise<boolean>
  /** OS actions (whitelisted or scoped in main). */
  openApp: (name: string) => Promise<{ ok: boolean; label?: string; focused?: boolean; error?: string }>
  closeApp: (name: string) => Promise<{ ok: boolean; label?: string; error?: string }>
  /** Close whatever window is in the foreground right now. */
  closeCurrentApp: () => Promise<{ ok: boolean; label: string; error?: string }>
  /** Minimise every window — back to the desktop. */
  showDesktop: () => Promise<boolean>
  cleanTemp: () => Promise<{ freedMB: number; files: number }>
  /** Clean up on screen — opens the folder and clears it where you can see. */
  cleanTempVisible: () => Promise<{ freedMB: number; files: number; shown: boolean }>
  emptyRecycleBin: () => Promise<{ freedMB: number; files: number }>
  openFolder: (name: string) => Promise<{ ok: boolean; label?: string; error?: string }>
  /** Serve a folder listing / a file to another of your devices. */
  serveList: (root: string, rel: string) => Promise<string>
  serveRead: (root: string, rel: string) => Promise<string>
  openFile: (query: string) => Promise<{ ok: boolean; label?: string; count?: number; error?: string }>
  lockWorkstation: () => Promise<boolean>
  power: (mode: string) => Promise<boolean>
  /** The foreground window's title + process, so Sentinel can speak up about it. */
  activeWindow: () => Promise<{ title: string; process: string } | null>
  /** All running apps with window titles — for "close Chrome" etc. */
  runningApps: () => Promise<Array<{ name: string; title: string }>>
  /** Apply input from the machine remotely driving this one. */
  remoteInput: (events: unknown[]) => Promise<boolean>
  remoteInputStop: () => Promise<boolean>
  /** Release every held key on the host — called when the session ends or the viewer loses focus. */
  resetRemoteKeyState: () => Promise<boolean>
  volume: (direction: 'up' | 'down' | 'mute') => Promise<boolean>

  /** Call the backend from the main process (token attached there). */
  api: <T = unknown>(req: ApiRequest) => Promise<ApiResponse<T>>
  /** Store the pairing token (encrypted by the OS keystore, in main). */
  tokenSet: (token: string) => Promise<boolean>
  tokenClear: () => Promise<boolean>
  /** Whether this device is linked. There is no way to READ the token. */
  tokenPresent: () => Promise<boolean>

  /** Sentinel's memory — facts it keeps about you. Local file, never uploaded. */
  memoryList: () => Promise<SentinelMemory[]>
  memoryAdd: (text: string) => Promise<SentinelMemory[]>
  memoryForget: (id: string) => Promise<SentinelMemory[]>
  memoryClear: () => Promise<SentinelMemory[]>

  /** The local, aggregated activity journal Sentinel learns your habits from. */
  activityRecord: (process: string, title: string, minutes: number) => Promise<ActivityBucket[]>
  activityList: () => Promise<ActivityBucket[]>
  activityClear: () => Promise<ActivityBucket[]>
}

export interface SentinelMemory {
  id: string
  text: string
  createdAt: number
}

/** One aggregated slice of how you spent time — never a raw activity log. */
export interface ActivityBucket {
  day: string
  process: string
  part: string
  minutes: number
  samples: string[]
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
  /** The window in the foreground, so Sentinel knows what you're actually doing. */
  activeWindow?: { title: string; process: string } | null
  /** What Sentinel has noticed about your habits, from the local journal. */
  habits?: string
}

declare global {
  interface Window {
    senti: SentinelAPI
  }
}

export {}
