import { contextBridge, ipcRenderer } from 'electron'

/**
 * The renderer's entire view of the outside world.
 *
 * Deliberately NO way to read the device token: the renderer can link, unlink,
 * and check whether a token exists, but the value itself never crosses this
 * bridge. All backend calls go through `api`, which runs in the main process
 * and attaches the token there — so a compromised renderer (XSS, a rogue
 * dependency, an open DevTools) cannot steal the credential.
 */
contextBridge.exposeInMainWorld('senti', {
  platform: () => ipcRenderer.invoke('senti:get-platform'),
  deviceInfo: () => ipcRenderer.invoke('senti:device-info'),
  quit: () => ipcRenderer.invoke('senti:quit'),

  /** 'setup' first run, 'panel' control center, 'hud' the floating orb. */
  setWindowMode: (mode: 'setup' | 'hud' | 'panel') => ipcRenderer.invoke('senti:set-window-mode', mode),
  /** Fill the display while driving another machine, and give it back after. */
  enterFullscreen: () => ipcRenderer.invoke('senti:enter-fullscreen'),
  exitFullscreen: () => ipcRenderer.invoke('senti:exit-fullscreen'),
  hudShow: () => ipcRenderer.invoke('senti:hud-show'),
  hudHide: () => ipcRenderer.invoke('senti:hud-hide'),
  /** Fired from the tray / second launch. Returns an unsubscribe function. */
  onOpenSettings: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('senti:open-settings', handler)
    return () => ipcRenderer.removeListener('senti:open-settings', handler)
  },

  /** Tap-to-talk hotkey pressed. Returns an unsubscribe function. */
  onTalk: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('senti:talk', handler)
    return () => ipcRenderer.removeListener('senti:talk', handler)
  },

  // Setup-completion flag, persisted to a FILE in main (origin-independent, so
  // it survives a local-server port change). Read synchronously at boot.
  setupCompletedAtBoot: (() => {
    try {
      return ipcRenderer.sendSync('senti:get-setup') === true
    } catch {
      return false
    }
  })(),
  persistSetupCompleted: (done: boolean) => ipcRenderer.invoke('senti:set-setup', done),

  /** Real vitals for THIS machine, so the assistant can answer about it. */
  systemInfo: () => ipcRenderer.invoke('senti:system-info'),

  /** Screenshots — only ever taken because you asked for one. */
  screenshotSave: () => ipcRenderer.invoke('senti:screenshot-save'),
  screenshotGrab: () => ipcRenderer.invoke('senti:screenshot-grab'),

  /** Desktop capture source ids for the live remote screen view. */
  screenSources: () => ipcRenderer.invoke('senti:screen-sources'),

  /** OS clipboard (text only), for cross-device clipboard sync. */
  clipboardRead: () => ipcRenderer.invoke('senti:clipboard-read'),
  clipboardWrite: (text: string) => ipcRenderer.invoke('senti:clipboard-write', text),

  /** Senti's memory — facts it keeps about you. Local file, never uploaded. */
  memoryList: () => ipcRenderer.invoke('senti:memory-list'),
  memoryAdd: (text: string) => ipcRenderer.invoke('senti:memory-add', text),
  memoryForget: (id: string) => ipcRenderer.invoke('senti:memory-forget', id),
  memoryClear: () => ipcRenderer.invoke('senti:memory-clear'),

  /** The local, aggregated activity journal Senti learns your habits from. */
  activityRecord: (process: string, title: string, minutes: number) =>
    ipcRenderer.invoke('senti:activity-record', process, title, minutes),
  activityList: () => ipcRenderer.invoke('senti:activity-list'),
  activityClear: () => ipcRenderer.invoke('senti:activity-clear'),
  /** Hold the machine awake while a monitored task runs. */
  keepAwake: (on: boolean, holder: string) => ipcRenderer.invoke('senti:keep-awake', on, holder),

  /** OS actions. All whitelisted or scoped in main — never a raw command. */
  openApp: (name: string) => ipcRenderer.invoke('senti:open-app', name),
  closeApp: (name: string) => ipcRenderer.invoke('senti:close-app', name),
  /** Close whatever window is in the foreground right now. */
  closeCurrentApp: () => ipcRenderer.invoke('senti:close-current-app'),
  /** Minimise every window — back to the desktop. */
  showDesktop: () => ipcRenderer.invoke('senti:show-desktop'),
  cleanTemp: () => ipcRenderer.invoke('senti:clean-temp'),
  /** Clean up on screen — opens the folder and clears it where you can see. */
  cleanTempVisible: () => ipcRenderer.invoke('senti:clean-temp-visible'),
  emptyRecycleBin: () => ipcRenderer.invoke('senti:empty-recycle-bin'),
  openFolder: (name: string) => ipcRenderer.invoke('senti:open-folder', name),
  /** Serve a folder listing / a file to another of your devices. */
  serveList: (root: string, rel: string) => ipcRenderer.invoke('senti:serve-list', root, rel),
  serveRead: (root: string, rel: string) => ipcRenderer.invoke('senti:serve-read', root, rel),
  openFile: (query: string) => ipcRenderer.invoke('senti:open-file', query),
  lockWorkstation: () => ipcRenderer.invoke('senti:lock-workstation'),
  power: (mode: string) => ipcRenderer.invoke('senti:power', mode),
  /** The foreground window's title + process, so Senti can speak up about it. */
  activeWindow: () => ipcRenderer.invoke('senti:active-window'),
  /** Apply input from the machine remotely driving this one. */
  remoteInput: (events: unknown[]) => ipcRenderer.invoke('senti:remote-input', events),
  remoteInputStop: () => ipcRenderer.invoke('senti:remote-input-stop'),
  /** Release every held key on the host — called when the session ends. */
  resetRemoteKeyState: () => ipcRenderer.invoke('senti:reset-remote-key-state'),
  volume: (direction: 'up' | 'down' | 'mute') => ipcRenderer.invoke('senti:volume', direction),

  // Backend access — the token is attached in main, never exposed here.
  api: (req: { baseUrl: string; path: string; method?: string; body?: unknown; auth?: boolean }) =>
    ipcRenderer.invoke('senti:api', req),
  tokenSet: (token: string) => ipcRenderer.invoke('senti:token-set', token),
  tokenClear: () => ipcRenderer.invoke('senti:token-clear'),
  tokenPresent: () => ipcRenderer.invoke('senti:token-present'),
})
