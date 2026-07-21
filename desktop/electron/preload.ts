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
  lock: () => ipcRenderer.invoke('senti:lock'),
  quit: () => ipcRenderer.invoke('senti:quit'),
  setLockState: (locked: boolean) => ipcRenderer.invoke('senti:set-lock-state', locked),
  /** True while first-time setup is showing: a normal window, not a lock. */
  setSetupMode: (inSetup: boolean) => ipcRenderer.invoke('senti:set-setup-mode', inSetup),

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

  // Backend access — the token is attached in main, never exposed here.
  api: (req: { baseUrl: string; path: string; method?: string; body?: unknown; auth?: boolean }) =>
    ipcRenderer.invoke('senti:api', req),
  tokenSet: (token: string) => ipcRenderer.invoke('senti:token-set', token),
  tokenClear: () => ipcRenderer.invoke('senti:token-clear'),
  tokenPresent: () => ipcRenderer.invoke('senti:token-present'),
})
