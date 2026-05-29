/// <reference types="vite/client" />

interface SentiAPI {
  platform: () => Promise<string>
  lock: () => Promise<void>
  quit: () => Promise<void>
  onBackendStatus: (callback: (data: unknown) => void) => void
  onBackendAlert: (callback: (data: unknown) => void) => void
  sendToBackend: (channel: string, data: unknown) => void
}

declare global {
  interface Window {
    senti: SentiAPI
  }
}