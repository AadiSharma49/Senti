/**
 * Security policy — the account-level settings the dashboard owns and the
 * desktop obeys. This is the shared shape both apps agree on.
 *
 * Unlock is VOICE ONLY: the user says anything at all and Senti unlocks if the
 * voiceprint matches. There is no wake phrase, keyword or passphrase — identity
 * is proven by WHO is speaking, not WHAT they say.
 */
export interface Policy {
  /** Voice match strictness (cosine threshold, 0.3 lenient .. 0.7 strict). */
  voiceThreshold: number
  /** Failed PIN attempts before lockout. */
  maxAttempts: number
  /** Lockout cool-down, seconds. */
  lockoutDuration: number
}

export const DEFAULT_POLICY: Policy = {
  voiceThreshold: 0.5,
  maxAttempts: 3,
  lockoutDuration: 30,
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function normalizePolicy(input: unknown): Policy {
  const p = { ...DEFAULT_POLICY, ...(input as Partial<Policy> | null) }
  return {
    voiceThreshold: clamp(Number(p.voiceThreshold) || 0.5, 0.3, 0.7),
    maxAttempts: Math.round(clamp(Number(p.maxAttempts) || 3, 1, 10)),
    lockoutDuration: Math.round(clamp(Number(p.lockoutDuration) || 30, 5, 300)),
  }
}
