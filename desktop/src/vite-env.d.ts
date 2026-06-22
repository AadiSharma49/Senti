/// <reference types="vite/client" />

interface SentiAPI {
  platform: () => Promise<string>
  lock: () => Promise<void>
  quit: () => Promise<void>
}

declare global {
  interface Window {
    senti: SentiAPI
  }
}

export {}