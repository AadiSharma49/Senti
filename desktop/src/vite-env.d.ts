/// <reference types="vite/client" />

interface SentiAPI {
  platform: () => Promise<string>
  deviceInfo: () => Promise<{ hostname: string; platform: string }>
  lock: () => Promise<void>
  quit: () => Promise<boolean>
  setLockState: (locked: boolean) => Promise<void>
}

declare global {
  interface Window {
    senti: SentiAPI
  }
}

export {}