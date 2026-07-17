/// <reference types="vite/client" />

export interface ApiRequest {
  baseUrl: string
  path: string
  method?: string
  body?: unknown
  /** Attach the device token (default true). */
  auth?: boolean
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

interface SentiAPI {
  platform: () => Promise<string>
  deviceInfo: () => Promise<{ hostname: string; platform: string }>
  lock: () => Promise<void>
  quit: () => Promise<boolean>
  setLockState: (locked: boolean) => Promise<void>
  /** True while first-time setup is showing: a normal window, not a lock. */
  setSetupMode: (inSetup: boolean) => Promise<boolean>

  /** Call the backend from the main process (token attached there). */
  api: <T = unknown>(req: ApiRequest) => Promise<ApiResponse<T>>
  /** Store the pairing token (encrypted by the OS keystore, in main). */
  tokenSet: (token: string) => Promise<boolean>
  tokenClear: () => Promise<boolean>
  /** Whether this device is linked. There is no way to READ the token. */
  tokenPresent: () => Promise<boolean>
}

declare global {
  interface Window {
    senti: SentiAPI
  }
}

export {}
