import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/crypto'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { SESSION_STALE_MS } from '@/lib/remote'

/**
 * Remote-control sessions: one of your machines driving another.
 *
 * Both ends are already token-authenticated to the same account, so the PIN
 * here is a deliberate SECOND factor. The threat it answers is a stolen laptop
 * that is already linked — without the PIN, whoever holds it could drive your
 * desktop. So: no PIN set on the target, no remote control, ever.
 *
 * A session must reach `active` (PIN verified) before a single input event is
 * accepted, and it dies after a few wrong guesses rather than allowing a
 * brute force against a short PIN.
 */
export const runtime = 'nodejs'

const MAX_PIN_ATTEMPTS = 5

/** POST — start a session (viewer), or verify its PIN. */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : 'start'

  if (action === 'start') {
    const targetId = typeof body.targetDeviceId === 'string' ? body.targetDeviceId : ''
    if (!targetId || targetId === auth.device.id)
      return NextResponse.json({ error: 'Bad target' }, { status: 400, headers: NO_STORE })

    const target = await prisma.device.findFirst({
      where: { id: targetId, userId: auth.device.userId },
    })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })

    // No PIN on that machine means remote control was never enabled there.
    if (!target.remotePinHash)
      return NextResponse.json(
        { error: 'no-pin', message: `Remote control isn't set up on ${target.name}. Set a remote PIN in its Control Center first.` },
        { status: 409, headers: NO_STORE }
      )

    // One live session per target: taking over replaces the old one.
    await prisma.remoteSession.updateMany({
      where: { targetDeviceId: targetId, state: { in: ['pending', 'active'] } },
      data: { state: 'ended', endedAt: new Date() },
    })

    const session = await prisma.remoteSession.create({
      data: { userId: auth.device.userId, viewerDeviceId: auth.device.id, targetDeviceId: targetId },
    })
    return NextResponse.json({ id: session.id, state: session.state }, { headers: NO_STORE })
  }

  if (action === 'verify') {
    const id = typeof body.id === 'string' ? body.id : ''
    const pin = typeof body.pin === 'string' ? body.pin : ''
    const session = await prisma.remoteSession.findFirst({
      where: { id, userId: auth.device.userId, viewerDeviceId: auth.device.id },
    })
    if (!session || session.state === 'ended')
      return NextResponse.json({ error: 'No session' }, { status: 404, headers: NO_STORE })

    const target = await prisma.device.findUnique({ where: { id: session.targetDeviceId } })
    // Compared as hashes; the PIN itself is never stored in readable form.
    if (!target?.remotePinHash || hashToken(pin) !== target.remotePinHash) {
      const attempts = session.attempts + 1
      const dead = attempts >= MAX_PIN_ATTEMPTS
      await prisma.remoteSession.update({
        where: { id: session.id },
        data: { attempts, ...(dead ? { state: 'ended', endedAt: new Date() } : {}) },
      })
      return NextResponse.json(
        { error: 'bad-pin', attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - attempts) },
        { status: 403, headers: NO_STORE }
      )
    }

    await prisma.remoteSession.update({
      where: { id: session.id },
      data: { state: 'active', heartbeatAt: new Date() },
    })
    return NextResponse.json({ ok: true, state: 'active' }, { headers: NO_STORE })
  }

  if (action === 'heartbeat' || action === 'end') {
    const id = typeof body.id === 'string' ? body.id : ''
    const ending = action === 'end'
    await prisma.remoteSession.updateMany({
      where: { id, userId: auth.device.userId },
      data: ending ? { state: 'ended', endedAt: new Date() } : { heartbeatAt: new Date() },
    })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }

  return NextResponse.json({ error: 'Bad action' }, { status: 400, headers: NO_STORE })
}

/**
 * GET — the TARGET asks "is someone controlling me right now?"
 *
 * Also how the target knows to speed its screen up and show the banner. An
 * abandoned session (viewer went away) reads as no session at all.
 */
export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const session = await prisma.remoteSession.findFirst({
    where: { targetDeviceId: auth.device.id, state: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) return NextResponse.json({ session: null }, { headers: NO_STORE })

  if (Date.now() - new Date(session.heartbeatAt).getTime() > SESSION_STALE_MS) {
    await prisma.remoteSession.update({
      where: { id: session.id },
      data: { state: 'ended', endedAt: new Date() },
    })
    return NextResponse.json({ session: null }, { headers: NO_STORE })
  }

  return NextResponse.json(
    { session: { id: session.id, viewerDeviceId: session.viewerDeviceId } },
    { headers: NO_STORE }
  )
}
