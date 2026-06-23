export type AuthMethod = 'voice' | 'clap' | 'pin' | 'remote' | 'telegram'

export type SessionState =
  | 'booting'
  | 'locked'
  | 'listening_voice'
  | 'listening_clap'
  | 'pin_entry'
  | 'verifying'
  | 'failed'
  | 'lockout'
  | 'unlocked'

export interface AuthConfig {
  enabledMethods: AuthMethod[]
  maxAttempts: number
  lockoutDuration: number
  pin: string
}

export interface LockStore {
  state: SessionState
  currentAuthMethod: AuthMethod | null
  failedAttempts: number
  lockoutUntil: number | null

  startBoot: () => void
  lock: () => void

  startVoiceAttempt: () => void
  startClapAttempt: () => void
  enterPinEntry: () => void

  verifyPin: (pin: string) => boolean

  authSuccess: () => void
  authFail: () => void

  resetFailedAttempts: () => void
}
