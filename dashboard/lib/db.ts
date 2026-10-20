import { prisma } from './prisma'
import { newDeviceToken, hashToken } from './crypto'

/**
 * Data-access helpers. The dashboard (Clerk-authed) manages a user's
 * devices; devices authenticate with a per-device token.
 *
 * Secrets never land here in the clear: device tokens are stored as hashes.
 */

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

export async function deleteDevice(userId: string, id: string) {
  await prisma.device.deleteMany({ where: { id, userId } })
}

/** Look up a device by its token, with the owner's policy. */
/** Resolve a device from its raw token by hashing it — the DB holds no raw tokens. */
export async function getDeviceByToken(token: string) {
  return prisma.device.findUnique({ where: { tokenHash: hashToken(token) } })
}

/**
 * Thrown when a check-in's hardware fingerprint already belongs to a
 * currently-linked device under a DIFFERENT account — i.e. someone is
 * trying to link this physical PC to a second account while it's still
 * linked to the first. The caller (the policy route) turns this into a
 * 409 with a message the desktop surfaces to the user.
 */
export class DeviceConflictError extends Error {
  constructor() {
    super('This computer is already linked to a different account. Unlink it there first.')
    this.name = 'DeviceConflictError'
  }
}

/** Record that a device checked in, and let it report its name/os. */
export async function touchDevice(
  id: string,
  info: { name?: string; os?: string; status?: string; hardwareIdHash?: string }
) {
  if (info.hardwareIdHash) {
    const conflict = await prisma.device.findFirst({
      where: {
        hardwareIdHash: info.hardwareIdHash,
        linked: true,
        NOT: { id },
      },
      select: { userId: true },
    })
    const mine = await prisma.device.findUnique({ where: { id }, select: { userId: true } })
    if (conflict && mine && conflict.userId !== mine.userId) {
      throw new DeviceConflictError()
    }
  }

  await prisma.device.update({
    where: { id },
    data: {
      lastSeen: new Date(),
      linked: true,
      ...(info.name ? { name: info.name } : {}),
      ...(info.os ? { os: info.os } : {}),
      ...(info.status ? { status: info.status } : {}),
      ...(info.hardwareIdHash ? { hardwareIdHash: info.hardwareIdHash } : {}),
    },
  })
}
