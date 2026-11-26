import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashRemoteCredential, MIN_PIN_LENGTH, MAX_PIN_LENGTH } from '@/lib/remoteAuth'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

// The PIN fallback is set from the target device and never returned by the
// API. Store it with a per-PIN salt and a slow password KDF.
export const runtime = 'nodejs'

/** GET — only whether a PIN exists. Never the PIN. */
export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const device = await prisma.device.findUnique({ where: { id: auth.device.id } })
  return NextResponse.json({ set: !!device?.remotePinHash }, { headers: NO_STORE })
}

/** POST — set or change this machine's remote PIN. */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const body = (await req.json().catch(() => null)) ?? {}
  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
  if (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH)
    return NextResponse.json(
      { error: `PIN must be ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} characters.` },
      { status: 400, headers: NO_STORE }
    )

  await prisma.device.update({
    where: { id: auth.device.id },
    data: { remotePinHash: await hashRemoteCredential(pin) },
  })
  return NextResponse.json({ ok: true, set: true }, { headers: NO_STORE })
}

/** DELETE — clear the PIN fallback and end any current session. */
export async function DELETE(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  // Lock the target for both changes, like start and verify do.
  await prisma.$transaction([
    prisma.device.update({ where: { id: auth.device.id }, data: { remotePinHash: null } }),
    prisma.remoteSession.updateMany({
      where: { targetDeviceId: auth.device.id, state: { in: ['pending', 'active'] } },
      data: { state: 'ended', endedAt: new Date() },
    }),
  ])
  return NextResponse.json({ ok: true, set: false }, { headers: NO_STORE })
}
