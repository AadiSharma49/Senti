import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'

export const MIN_PIN_LENGTH = 4
export const MAX_PIN_LENGTH = 12

const VERSION = 'scrypt-v1'
const KEY_BYTES = 32
// Keep memory per derivation to ~32 MiB and use three passes for additional work.
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }

function derive(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEY_BYTES, OPTIONS, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

/** PINs and email codes are short and guessable, unlike random device tokens. */
export async function hashRemoteCredential(secret: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(secret, salt)
  return `${VERSION}:${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyRemoteCredential(secret: string, stored: string): Promise<boolean> {
  const [version, salt, key, ...rest] = stored.split(':')
  if (version !== VERSION || rest.length || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(key)) {
    return false // Reject malformed and pre-migration SHA-256 hashes.
  }
  return timingSafeEqual(await derive(secret, Buffer.from(salt, 'hex')), Buffer.from(key, 'hex'))
}

export const MAX_REMOTE_AUTH_ATTEMPTS = 5
const COOLDOWN_MS = 10 * 60_000
const CODE_TTL_MS = 10 * 60_000

interface Viewer {
  id: string
  userId: string
}

type Target = Pick<Prisma.DeviceGetPayload<{}>, 'id' | 'name' | 'remotePinHash' | 'remoteAuthFailures' | 'remoteAuthExpiresAt'>

// Lock the target, not the session. All starts/verifications for this target
// (even from different viewers or app instances) will serialize in Postgres.
async function lockTarget(tx: Prisma.TransactionClient, deviceId: string, userId: string) {
  const [target] = await tx.$queryRaw<Target[]>`
    SELECT "id", "name", "remotePinHash", "remoteAuthFailures", "remoteAuthExpiresAt"
    FROM "Device" WHERE "id" = ${deviceId} AND "userId" = ${userId} FOR UPDATE
  `
  return target
}

function budget(target: Target, now: number) {
  const remainingMs = Math.max(0, (target.remoteAuthExpiresAt?.getTime() ?? now) - now)
  const failures = remainingMs ? target.remoteAuthFailures : 0
  return { failures, retryAfterMs: failures >= MAX_REMOTE_AUTH_ATTEMPTS ? remainingMs : 0 }
}

export async function startRemoteSession(
  db: PrismaClient,
  viewer: Viewer,
  targetId: string,
  email: string | null
) {
  return db.$transaction(async (tx) => {
    const target = await lockTarget(tx, targetId, viewer.userId)
    if (!target) return { kind: 'not-found' } as const

    const { retryAfterMs } = budget(target, Date.now())
    if (retryAfterMs) return { kind: 'locked-out', retryAfterMs } as const
    if (!email && !target.remotePinHash) return { kind: 'no-pin', targetName: target.name } as const

    const code = email ? String(randomInt(0, 1_000_000)).padStart(6, '0') : null
    const emailCodeHash = code ? await hashRemoteCredential(code) : null
    const now = new Date()
    await tx.remoteSession.updateMany({
      where: { targetDeviceId: targetId, state: { in: ['pending', 'active'] } },
      data: { state: 'ended', endedAt: now },
    })
    const session = await tx.remoteSession.create({
      data: {
        userId: viewer.userId,
        viewerDeviceId: viewer.id,
        targetDeviceId: targetId,
        emailCodeHash,
        emailCodeSentAt: code ? now : null,
      },
    })
    return { kind: 'started', id: session.id, code, targetName: target.name, hasPin: !!target.remotePinHash } as const
  }, { isolationLevel: 'ReadCommitted' })
}

export async function verifyRemoteSession(db: PrismaClient, viewer: Viewer, id: string, secret: string) {
  const pending = { id, userId: viewer.userId, viewerDeviceId: viewer.id, state: 'pending' }
  // Find the row to lock, then re-read the session under the lock. A start
  // may have replaced it in the meantime.
  const candidate = await db.remoteSession.findFirst({ where: pending, select: { targetDeviceId: true } })
  if (!candidate) return { kind: 'not-found' } as const

  return db.$transaction(async (tx) => {
    const target = await lockTarget(tx, candidate.targetDeviceId, viewer.userId)
    if (!target) return { kind: 'not-found' } as const

    const { failures, retryAfterMs } = budget(target, Date.now())
    if (retryAfterMs) return { kind: 'locked-out', retryAfterMs } as const
    const session = await tx.remoteSession.findFirst({ where: pending })
    if (!session) return { kind: 'not-found' } as const

    const now = Date.now()
    const codeFresh = session.emailCodeSentAt && now - session.emailCodeSentAt.getTime() < CODE_TTL_MS
    // An expired email code never falls back to the static PIN.
    const hash = session.emailCodeHash ? (codeFresh ? session.emailCodeHash : null) : target.remotePinHash
    const matches = hash && secret.length >= MIN_PIN_LENGTH && secret.length <= MAX_PIN_LENGTH
      && await verifyRemoteCredential(secret, hash)

    if (matches) {
      // A concurrent explicit end must never be undone by verification.
      const { count } = await tx.remoteSession.updateMany({
        where: pending,
        data: { state: 'active', heartbeatAt: new Date(), emailCodeHash: null, emailCodeSentAt: null },
      })
      if (!count) return { kind: 'not-found' } as const
      await tx.device.update({
        where: { id: target.id },
        data: { remoteAuthFailures: 0, remoteAuthExpiresAt: null },
      })
      return { kind: 'verified' } as const
    }

    const attemptsLeft = MAX_REMOTE_AUTH_ATTEMPTS - failures - 1
    await tx.device.update({
      where: { id: target.id },
      data: { remoteAuthFailures: failures + 1, remoteAuthExpiresAt: new Date(Date.now() + COOLDOWN_MS) },
    })
    if (attemptsLeft === 0) {
      await tx.remoteSession.updateMany({ where: pending, data: { state: 'ended', endedAt: new Date() } })
      return { kind: 'locked-out', retryAfterMs: COOLDOWN_MS } as const
    }
    return { kind: 'bad-pin', attemptsLeft } as const
  }, { isolationLevel: 'ReadCommitted' })
}
