import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/crypto'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { SESSION_STALE_MS } from '@/lib/remote'
import { emailEnabled, sendRemoteCode } from '@/lib/email'
import { randomInt } from 'crypto'

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
/** A code that lives forever is barely a second factor. */
const CODE_TTL_MS = 10 * 60_000

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

    // Email codes are the stronger factor, so they're preferred when
    // available. The static PIN remains the fallback: a machine with neither
    // has never had remote control enabled and must refuse outright.
    const owner = await prisma.user.findUnique({ where: { id: auth.device.userId } })
    const canEmail = emailEnabled && !!owner?.email
    if (!canEmail && !target.remotePinHash)
      return NextResponse.json(
        { error: 'no-pin', message: `Remote control isn't set up on ${target.name}. Set a remote PIN in its Control Center first.` },
        { status: 409, headers: NO_STORE }
      )

    // One live session per target: taking over replaces the old one.
    await prisma.remoteSession.updateMany({
      where: { targetDeviceId: targetId, state: { in: ['pending', 'active'] } },
      data: { state: 'ended', endedAt: new Date() },
    })

    // randomInt is the cryptographic generator — Math.random is predictable
    // enough to be guessable, which for an access code is the whole ballgame.
    const code = canEmail ? String(randomInt(0, 1_000_000)).padStart(6, '0') : null
    const session = await prisma.remoteSession.create({
      data: {
        userId: auth.device.userId,
        viewerDeviceId: auth.device.id,
        targetDeviceId: targetId,
        emailCodeHash: code ? hashToken(code) : null,
        emailCodeSentAt: code ? new Date() : null,
      },
    })

    let sent = false
    if (code && owner?.email) {
      sent = await sendRemoteCode(owner.email, code, target.name)
      if (!sent) {
        // Delivery failed. Drop the code so the session falls back to the PIN
        // rather than waiting on an email that will never arrive.
        await prisma.remoteSession.update({
          where: { id: session.id },
          data: { emailCodeHash: null, emailCodeSentAt: null },
        })
      }
    }

    return NextResponse.json(
      {
        id: session.id,
        state: session.state,
        // Tells the UI what to ask for — a code from email, or the PIN.
        method: sent ? 'email' : 'pin',
        sentTo: sent ? maskEmail(owner!.email!) : undefined,
      },
      { headers: NO_STORE }
    )
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

    // An emailed code, when this session has one and it hasn't expired.
    const codeFresh =
      !!session.emailCodeSentAt && Date.now() - new Date(session.emailCodeSentAt).getTime() < CODE_TTL_MS
    const codeOk = !!session.emailCodeHash && codeFresh && hashToken(pin) === session.emailCodeHash

    // Otherwise the machine's own PIN — but ONLY when no live code exists.
    // Accepting either would make the pair as weak as its weaker half, which
    // defeats the point of emailing a code at all.
    const pinOk =
      !session.emailCodeHash && !!target?.remotePinHash && hashToken(pin) === target.remotePinHash

    if (!codeOk && !pinOk) {
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

    // Burn the code on success — a one-time code that survives its use isn't
    // one, and a reconnect should require a fresh email.
    await prisma.remoteSession.update({
      where: { id: session.id },
      data: { state: 'active', heartbeatAt: new Date(), emailCodeHash: null },
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
