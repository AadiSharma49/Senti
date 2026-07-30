import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/crypto'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * The PIN that must be entered before anyone — including you — can take
 * remote control of THIS machine.
 *
 * Set from the machine itself, on purpose: enabling remote control of a
 * computer should require sitting at that computer once. Stored as a SHA-256
 * hash, so a database leak yields nothing usable, and there is deliberately no
 * way to read it back.
 */
export const runtime = 'nodejs'

const MIN_PIN = 4
const MAX_PIN = 12

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

  const body = await req.json().catch(() => ({}))
  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
  if (pin.length < MIN_PIN || pin.length > MAX_PIN)
    return NextResponse.json(
      { error: `PIN must be ${MIN_PIN}-${MAX_PIN} characters.` },
      { status: 400, headers: NO_STORE }
    )

  await prisma.device.update({
    where: { id: auth.device.id },
    data: { remotePinHash: hashToken(pin) },
  })
  return NextResponse.json({ ok: true, set: true }, { headers: NO_STORE })
}

/** DELETE — turn remote control off for this machine entirely. */
export async function DELETE(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  await prisma.device.update({ where: { id: auth.device.id }, data: { remotePinHash: null } })
  // Any live session loses its footing immediately.
  await prisma.remoteSession.updateMany({
    where: { targetDeviceId: auth.device.id, state: { in: ['pending', 'active'] } },
    data: { state: 'ended', endedAt: new Date() },
  })
  return NextResponse.json({ ok: true, set: false }, { headers: NO_STORE })
}
