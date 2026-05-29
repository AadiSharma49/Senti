import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('senti', {
  platform: () => ipcRenderer.invoke('senti:get-platform'),
  lock: () => ipcRenderer.invoke('senti:lock'),
  quit: () => ipcRenderer.invoke('senti:quit'),

  onBackendStatus: (callback: (data: unknown) => void) => {
    ipcRenderer.on('backend:status', (_event, data) => callback(data))
  },
  onBackendAlert: (callback: (data: unknown) => void) => {
    ipcRenderer.on('backend:alert', (_event, data) => callback(data))
  },
  sendToBackend: (channel: string, data: unknown) => {
    ipcRenderer.send('backend:send', { channel, data })
  },
  // Returns a promise that resolves to the temporary MP3 file path for the greeting
  playGreeting: (period: string) => ipcRenderer.invoke('senti:play-greeting', period),
  // Simple health‑check wrapper for the backend process
  healthCheck: () => ipcRenderer.invoke('senti:backend-health'),
})
