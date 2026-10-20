import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Security primitives.
 *
 * Device tokens must survive a database leak: a token is a bearer credential
 * for a machine, so we store only its SHA-256 — like a password. Someone who
 * dumps the DB gets hashes, not working keys. (SHA-256 with no stretching is
 * right here: tokens are 192 bits of CSPRNG output, so there is no dictionary
 * to attack.)
 */

// --- Device tokens ---------------------------------------------------

/** A fresh device token. 24 bytes = 192 bits of entropy. */
export function newDeviceToken(): string {
  return randomBytes(24).toString('hex')
}

/** What we store. Never persist the raw token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time compare, so we don't leak the hash byte-by-byte via timing. */
export function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
