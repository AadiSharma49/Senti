/// <reference types="vite/client" />

interface SentiAPI {
  platform: () => Promise<string>
  lock: () => Promise<void>
  quit: () => Promise<void>
  onBackendStatus: (callback: (data: unknown) => void) => () => void
  onBackendAlert: (callback: (data: unknown) => void) => () => void
  sendToBackend: (channel: string, data: unknown) => void
  voiceStart: () => Promise<boolean>
  voiceStop: () => Promise<boolean>
  voiceTranscribe: (payload: unknown) => Promise<boolean>
  healthCheck: () => Promise<{ backendConnected: boolean; modelLoaded: boolean } | boolean>
  playGreeting: (period: string) => Promise<string | null>
}

declare global {
  interface Window {
    senti: SentiAPI
  }
}

export {}
