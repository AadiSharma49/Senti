import { contextBridge, ipcRenderer } from 'electron'

console.log('[PRELOAD] loaded')
console.log('[PRELOAD LOADED]')
console.log('[PRELOAD] ipc registered')

const voiceApi = {
  start: () => ipcRenderer.invoke('voice:start'),
  stop: () => ipcRenderer.invoke('voice:stop'),
  transcribe: (payload: unknown) => ipcRenderer.invoke('voice:transcribe', payload),
}

console.log('[PRELOAD] voice ipc registered')

contextBridge.exposeInMainWorld('senti', {
  platform: () => ipcRenderer.invoke('senti:get-platform'),
  lock: () => ipcRenderer.invoke('senti:lock'),
  quit: () => ipcRenderer.invoke('senti:quit'),

  onBackendStatus: (callback: (data: unknown) => void) => {
    const listener = (_event: any, data: unknown) => callback(data)
    ipcRenderer.on('backend:status', listener)
    return () => ipcRenderer.removeListener('backend:status', listener)
  },
  onBackendAlert: (callback: (data: unknown) => void) => {
    const listener = (_event: any, data: unknown) => callback(data)
    ipcRenderer.on('backend:alert', listener)
    return () => ipcRenderer.removeListener('backend:alert', listener)
  },
  sendToBackend: (channel: string, data: unknown) => {
    ipcRenderer.send('backend:send', { channel, data })
  },
  voice: voiceApi,
  voiceStart: voiceApi.start,
  voiceStop: voiceApi.stop,
  voiceTranscribe: voiceApi.transcribe,
  // Returns a promise that resolves to the temporary MP3 file path for the greeting
  playGreeting: (period: string) => ipcRenderer.invoke('senti:play-greeting', period),
  // Simple health‑check wrapper for the backend process
  healthCheck: () => ipcRenderer.invoke('senti:backend-health'),
})

console.log('[Preload] window.senti exposed', typeof (window as any).senti, typeof (window as any).senti?.voice?.start, typeof (window as any).senti?.voice?.stop, typeof (window as any).senti?.voice?.transcribe)
