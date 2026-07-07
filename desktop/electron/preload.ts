import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('senti', {
  platform: () => ipcRenderer.invoke('senti:get-platform'),
  deviceInfo: () => ipcRenderer.invoke('senti:device-info'),
  lock: () => ipcRenderer.invoke('senti:lock'),
  quit: () => ipcRenderer.invoke('senti:quit'),
  setLockState: (locked: boolean) => ipcRenderer.invoke('senti:set-lock-state', locked),
})