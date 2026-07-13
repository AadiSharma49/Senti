import { prisma } from './prisma'
import { normalizePolicy, type Policy } from './policy'
import { newDeviceToken, hashToken, encryptSecret, decryptSecret } from './crypto'

/**
 * Data-access helpers. The dashboard (Clerk-authed) manages a user's
 * policy and devices; devices authenticate with a per-device token.
 *
 * Secrets never land here in the clear: device tokens are stored as hashes,
 * voiceprints are encrypted (see lib/crypto.ts).
 */

function toPolicy(row: {
  voiceThreshold: number
  maxAttempts: number
  lockoutDuration: number
}): Policy {
  return normalizePolicy(row)
}

/** Ensure the account exists and return its policy (creating a default). */
export async function getOrCreatePolicy(
  userId: string,
  email?: string | null,
  name?: string | null
): Promise<Policy> {
  const fields: { email?: string; name?: string } = {}
  if (email) fields.email = email
  if (name) fields.name = name
  await prisma.user.upsert({
    where: { id: userId },
    update: fields,
    create: { id: userId, email: email ?? null, name: name ?? null },
  })
  const existing = await prisma.policy.findUnique({ where: { userId } })
  if (existing) return toPolicy(existing)
  const created = await prisma.policy.create({ data: { userId } })
  return toPolicy(created)
}

/** Apply a validated patch to the account policy. */
export async function updatePolicy(userId: string, patch: Partial<Policy>): Promise<Policy> {
  const current = await getOrCreatePolicy(userId)
  const next = normalizePolicy({ ...current, ...patch })
  const saved = await prisma.policy.update({ where: { userId }, data: next })
  return toPolicy(saved)
}

/**
 * Create a device + pairing token. The raw token is returned ONCE, for the
 * user to paste into the desktop; only its hash is persisted.
 */
export async function createDevice(userId: string): Promise<{ id: string; token: string }> {
  const token = newDeviceToken()
  const device = await prisma.device.create({
    data: { userId, name: 'New device', os: 'unknown', tokenHash: hashToken(token) },
  })
  return { id: device.id, token }
}

export async function listDevices(userId: string) {
  return prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
}

/** The account's security timeline (most recent first). Empty until devices report events. */
export async function listEvents(userId: string, limit = 25) {
  return prisma.unlockEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { device: true },
  })
}

export async function deleteDevice(userId: string, id: string) {
  await prisma.device.deleteMany({ where: { id, userId } })
}

/** Look up a device by its token, with the owner's policy. */
/** Resolve a device from its raw token by hashing it — the DB holds no raw tokens. */
export async function getDeviceByToken(token: string) {
  return prisma.device.findUnique({ where: { tokenHash: hashToken(token) } })
}

export interface VoiceprintData {
  embedding: number[]
  sampleCount: number
  modelId: string
}

/** The account's voiceprint (decrypted, parsed back to numbers), or null. */
export async function getVoiceprint(userId: string): Promise<(VoiceprintData & { createdAt: Date }) | null> {
  const row = await prisma.voiceProfile.findUnique({ where: { userId } })
  if (!row) return null
  let embedding: number[] = []
  try {
    embedding = JSON.parse(decryptSecret(row.embedding)) as number[]
  } catch {
    embedding = []
  }
  return { embedding, sampleCount: row.sampleCount, modelId: row.modelId, createdAt: row.createdAt }
}

/** Whether the account has a voiceprint, plus lightweight metadata (no embedding). */
export async function getVoiceprintStatus(userId: string) {
  const row = await prisma.voiceProfile.findUnique({
    where: { userId },
    select: { sampleCount: true, modelId: true, createdAt: true },
  })
  return row
}

export async function upsertVoiceprint(userId: string, data: VoiceprintData) {
  // Biometric data — encrypted before it ever reaches the database.
  const embedding = encryptSecret(JSON.stringify(data.embedding))
  await prisma.voiceProfile.upsert({
    where: { userId },
    update: { embedding, sampleCount: data.sampleCount, modelId: data.modelId },
    create: { userId, embedding, sampleCount: data.sampleCount, modelId: data.modelId },
  })
}

export async function deleteVoiceprint(userId: string) {
  await prisma.voiceProfile.deleteMany({ where: { userId } })
  await prisma.device.updateMany({ where: { userId }, data: { voiceEnrolled: false } })
}

/** Record that a device checked in, and let it report its name/os. */
export async function touchDevice(
  id: string,
  info: { name?: string; os?: string; status?: string; voiceEnrolled?: boolean }
) {
  await prisma.device.update({
    where: { id },
    data: {
      lastSeen: new Date(),
      linked: true,
      ...(info.name ? { name: info.name } : {}),
      ...(info.os ? { os: info.os } : {}),
      ...(info.status ? { status: info.status } : {}),
      ...(typeof info.voiceEnrolled === 'boolean' ? { voiceEnrolled: info.voiceEnrolled } : {}),
    },
  })
}
