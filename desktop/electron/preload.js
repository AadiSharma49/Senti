const { contextBridge, ipcRenderer } = require('electron')

console.log('[Preload] Preload Loaded')

const voiceApi = {
  start: () => ipcRenderer.invoke('voice:start'),
  stop: () => ipcRenderer.invoke('voice:stop'),
  transcribe: (payload) => ipcRenderer.invoke('voice:transcribe', payload),
}

console.log('[Preload] Voice IPC Registered')

contextBridge.exposeInMainWorld('senti', {
  platform: () => ipcRenderer.invoke('senti:get-platform'),
  lock: () => ipcRenderer.invoke('senti:lock'),
  quit: () => ipcRenderer.invoke('senti:quit'),

  onBackendStatus: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('backend:status', listener)
    return () => ipcRenderer.removeListener('backend:status', listener)
  },
  onBackendAlert: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('backend:alert', listener)
    return () => ipcRenderer.removeListener('backend:alert', listener)
  },
  sendToBackend: (channel, data) => {
    ipcRenderer.send('backend:send', { channel, data })
  },
  playGreeting: (period) => ipcRenderer.invoke('senti:play-greeting', period),
  healthCheck: () => ipcRenderer.invoke('senti:backend-health'),
  voice: voiceApi,
  voiceStart: voiceApi.start,
  voiceStop: voiceApi.stop,
  voiceTranscribe: voiceApi.transcribe,
})