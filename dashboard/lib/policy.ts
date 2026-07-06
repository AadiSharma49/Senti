/**
 * Security policy — the account-level settings the dashboard owns and the
 * desktop obeys. This is the shared shape both apps agree on.
 */
export type SecurityMode = 'voice_only' | 'phrase_and_voice'

export interface Policy {
  securityMode: SecurityMode
  /** Voice match strictness (cosine threshold, 0.3 lenient .. 0.7 strict). */
  voiceThreshold: number
  /** Failed PIN attempts before lockout. */
  maxAttempts: number
  /** Lockout cool-down, seconds. */
  lockoutDuration: number
}

export const DEFAULT_POLICY: Policy = {
  securityMode: 'phrase_and_voice',
  voiceThreshold: 0.5,
  maxAttempts: 3,
  lockoutDuration: 30,
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function normalizePolicy(input: unknown): Policy {
  const p = { ...DEFAULT_POLICY, ...(input as Partial<Policy> | null) }
  return {
    securityMode: p.securityMode === 'voice_only' ? 'voice_only' : 'phrase_and_voice',
    voiceThreshold: clamp(Number(p.voiceThreshold) || 0.5, 0.3, 0.7),
    maxAttempts: Math.round(clamp(Number(p.maxAttempts) || 3, 1, 10)),
    lockoutDuration: Math.round(clamp(Number(p.lockoutDuration) || 30, 5, 300)),
  }
}
