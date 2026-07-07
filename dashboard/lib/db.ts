import { randomBytes } from 'crypto'
import { prisma } from './prisma'
import { normalizePolicy, type Policy } from './policy'

/**
 * Data-access helpers. The dashboard (Clerk-authed) manages a user's
 * policy and devices; devices authenticate with a per-device token.
 */

function toPolicy(row: {
  securityMode: string
  voiceThreshold: number
  maxAttempts: number
  lockoutDuration: number
}): Policy {
  return normalizePolicy(row)
}

/** Ensure the account exists and return its policy (creating a default). */
export async function getOrCreatePolicy(userId: string, email?: string | null): Promise<Policy> {
  await prisma.user.upsert({
    where: { id: userId },
    update: email ? { email } : {},
    create: { id: userId, email: email ?? null },
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

/** Create a new device + pairing token for an account. */
export async function createDevice(userId: string): Promise<{ id: string; token: string }> {
  const token = randomBytes(24).toString('hex')
  const device = await prisma.device.create({
    data: { userId, name: 'New device', os: 'unknown', token },
  })
  return { id: device.id, token }
}

export async function listDevices(userId: string) {
  return prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
}

export async function deleteDevice(userId: string, id: string) {
  await prisma.device.deleteMany({ where: { id, userId } })
}

/** Look up a device by its token, with the owner's policy. */
export async function getDeviceByToken(token: string) {
  return prisma.device.findUnique({ where: { token } })
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
