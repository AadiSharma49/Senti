import { createHash, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto'

/**
 * Security primitives.
 *
 * Two things must survive a database leak:
 *
 *  - Device tokens. A token is a bearer credential for a machine, so we store
 *    only its SHA-256 — like a password. Someone who dumps the DB gets hashes,
 *    not working keys. (SHA-256 with no stretching is right here: tokens are
 *    192 bits of CSPRNG output, so there is no dictionary to attack.)
 *
 *  - Voiceprints. This is biometric data — the one thing a user can never
 *    rotate. Encrypted at rest with AES-256-GCM.
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

// --- Voiceprint encryption -------------------------------------------

/** 32-byte key from SENTI_ENCRYPTION_KEY, or null when it isn't configured. */
function encryptionKey(): Buffer | null {
  const raw = process.env.SENTI_ENCRYPTION_KEY
  if (!raw) return null
  // Accept either 64 hex chars or any passphrase (hashed to 32 bytes).
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
  return createHash('sha256').update(raw, 'utf8').digest()
}

export const encryptionEnabled = !!encryptionKey()

if (!encryptionEnabled && process.env.NODE_ENV !== 'production') {
  console.error(
    '[senti] SENTI_ENCRYPTION_KEY is not set. Voiceprints — biometric data — would be stored UNENCRYPTED. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  )
}

const PREFIX = 'enc:v1:'

/**
 * Encrypt a voiceprint payload (AES-256-GCM).
 *
 * If the key is missing we REFUSE rather than fall through to plaintext.
 * Storing a biometric in the clear because an env var was forgotten is the
 * worst possible failure: silent, invisible, and unfixable after the fact —
 * a voiceprint is the one credential a person can never rotate. A deploy that
 * forgets this key must break loudly, not leak quietly.
 */
export function encryptSecret(plaintext: string): string {
  const key = encryptionKey()
  if (!key) {
    throw new Error(
      'SENTI_ENCRYPTION_KEY is not set — refusing to store a voiceprint unencrypted. ' +
        'Set it in your environment (and in Vercel) to the SAME value everywhere.'
    )
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
}

/** Decrypt a value produced by encryptSecret. Handles rows written before encryption. */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored // legacy plaintext row
  const key = encryptionKey()
  if (!key) throw new Error('SENTI_ENCRYPTION_KEY missing — cannot read encrypted voiceprint')
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split('.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}
