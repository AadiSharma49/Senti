const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('senti', {
  platform: () => ipcRenderer.invoke('senti:get-platform'),
  lock: () => ipcRenderer.invoke('senti:lock'),
  quit: () => ipcRenderer.invoke('senti:quit'),

  onBackendStatus: (callback) => {
    ipcRenderer.on('backend:status', (_event, data) => callback(data))
  },
  onBackendAlert: (callback) => {
    ipcRenderer.on('backend:alert', (_event, data) => callback(data))
  },
  sendToBackend: (channel, data) => {
    ipcRenderer.send('backend:send', { channel, data })
  },
  playGreeting: (period) => ipcRenderer.invoke('senti:play-greeting', period),
  healthCheck: () => ipcRenderer.invoke('senti:backend-health'),
})