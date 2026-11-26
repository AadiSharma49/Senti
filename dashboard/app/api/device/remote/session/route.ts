import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { SESSION_STALE_MS } from '@/lib/remote'
import { emailEnabled, sendRemoteCode } from '@/lib/email'
import { startRemoteSession, verifyRemoteSession } from '@/lib/remoteAuth'

// Remote sessions remain pending until the viewer proves possession of the
// target's PIN or the one-time email code. The target owns the attempt budget.
export const runtime = 'nodejs'

function lockedOut(retryAfterMs: number) {
  return NextResponse.json(
    {
      error: 'locked-out',
      message: 'Too many wrong attempts on this device. Try again after the cooldown.',
      attemptsLeft: 0,
      retryAfterMs,
    },
    { status: 429, headers: { ...NO_STORE, 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
  )
}

/** "ad***@gmail.com" — enough to recognise your own inbox, not to learn it. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  const head = user.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`
}

/** POST — start a session (viewer), or verify its PIN. */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const body = (await req.json().catch(() => null)) ?? {}
  const action = typeof body.action === 'string' ? body.action : 'start'

  if (action === 'start') {
    const targetId = typeof body.targetDeviceId === 'string' ? body.targetDeviceId : ''
    if (!targetId || targetId === auth.device.id)
      return NextResponse.json({ error: 'Bad target' }, { status: 400, headers: NO_STORE })

    const owner = emailEnabled ? await prisma.user.findUnique({ where: { id: auth.device.userId } }) : null
    const email = owner?.email || null
    const result = await startRemoteSession(prisma, auth.device, targetId, email)
    if (result.kind === 'not-found') return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
    if (result.kind === 'locked-out') return lockedOut(result.retryAfterMs)
    if (result.kind === 'no-pin') {
      return NextResponse.json(
        { error: 'no-pin', message: `Remote control isn't set up on ${result.targetName}. Set a remote PIN in its Control Center first.` },
        { status: 409, headers: NO_STORE }
      )
    }

    // Keep email delivery outside the database transaction. A session may
    // already have ended, so only change the challenge on a pending session.
    let sentTo: string | undefined
    if (result.code && email) {
      if (await sendRemoteCode(email, result.code, result.targetName)) {
        sentTo = maskEmail(email)
      } else {
        await prisma.remoteSession.updateMany({
          where: { id: result.id, state: 'pending' },
          data: {
            emailCodeHash: null,
            emailCodeSentAt: null,
            ...(result.hasPin ? {} : { state: 'ended', endedAt: new Date() }),
          },
        })
        if (!result.hasPin) {
          return NextResponse.json(
            { error: 'code-delivery-failed', message: 'Could not send a code and this device has no remote PIN set.' },
            { status: 503, headers: NO_STORE }
          )
        }
      }
    }

    return NextResponse.json(
      { id: result.id, state: 'pending', method: sentTo ? 'email' : 'pin', sentTo },
      { headers: NO_STORE }
    )
  }

  if (action === 'verify') {
    const id = typeof body.id === 'string' ? body.id : ''
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    const result = await verifyRemoteSession(prisma, auth.device, id, pin)
    if (result.kind === 'not-found') return NextResponse.json({ error: 'No session' }, { status: 404, headers: NO_STORE })
    if (result.kind === 'locked-out') return lockedOut(result.retryAfterMs)
    if (result.kind === 'bad-pin') {
      return NextResponse.json(
        { error: 'bad-pin', attemptsLeft: result.attemptsLeft },
        { status: 403, headers: NO_STORE }
      )
    }
    return NextResponse.json({ ok: true, state: 'active' }, { headers: NO_STORE })
  }

  if (action === 'heartbeat' || action === 'end') {
    const id = typeof body.id === 'string' ? body.id : ''
    const ending = action === 'end'
    const { count } = await prisma.remoteSession.updateMany({
      where: {
        id, userId: auth.device.userId,
        ...(ending
          ? { OR: [{ viewerDeviceId: auth.device.id }, { targetDeviceId: auth.device.id }] }
          : { viewerDeviceId: auth.device.id, state: 'active', heartbeatAt: { gte: new Date(Date.now() - SESSION_STALE_MS) } }),
      },
      data: ending ? { state: 'ended', endedAt: new Date() } : { heartbeatAt: new Date() },
    })
    if (!count) return NextResponse.json({ error: 'No session' }, { status: 404, headers: NO_STORE })
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
  const auth = await authenticateDevice(req, 'remoteSession')
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
