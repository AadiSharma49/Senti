import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { SESSION_STALE_MS } from '@/lib/remote'

/**
 * The wire between the driving device and the driven one: mouse moves, clicks,
 * scrolls and keystrokes.
 *
 * Events are DELETED the instant they're delivered. This is a transport queue,
 * never a log of what you typed — a keylogger is exactly what this must not
 * become, and the only way to be sure is to not keep the data.
 *
 * Nothing is accepted unless the session is `active`, which means the PIN was
 * verified. A session that merely exists grants nothing.
 */
export const runtime = 'nodejs'

/** Enough for a burst of typing; anything more is a client bug or abuse. */
const MAX_BATCH = 64
const MAX_EVENT_CHARS = 2000

/** POST — the viewer queues a batch of input events. */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body.id === 'string' ? body.id : ''
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : []
  if (!sessionId || !events.length)
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })

  // Only the viewer of an ACTIVE (PIN-verified) session may send input.
  const session = await prisma.remoteSession.findFirst({
    where: {
      id: sessionId,
      userId: auth.device.userId,
      viewerDeviceId: auth.device.id,
      state: 'active',
    },
  })
  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 403, headers: NO_STORE })

  await prisma.remoteInput.createMany({
    data: events.map((e: unknown) => ({
      sessionId,
      data: JSON.stringify(e).slice(0, MAX_EVENT_CHARS),
    })),
  })
  // Sending input is itself proof the viewer is alive.
  await prisma.remoteSession.update({ where: { id: sessionId }, data: { heartbeatAt: new Date() } })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

/** GET — the target drains everything queued for it, in order. */
export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const session = await prisma.remoteSession.findFirst({
    where: { targetDeviceId: auth.device.id, state: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) return NextResponse.json({ events: [] }, { headers: NO_STORE })

  // A viewer that stopped heartbeating must not keep driving this machine.
  if (Date.now() - new Date(session.heartbeatAt).getTime() > SESSION_STALE_MS) {
    await prisma.remoteSession.update({
      where: { id: session.id },
      data: { state: 'ended', endedAt: new Date() },
    })
    return NextResponse.json({ events: [] }, { headers: NO_STORE })
  }

  const rows = await prisma.remoteInput.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  if (rows.length) {
    await prisma.remoteInput.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  }

  const events = rows
    .map((r) => {
      try {
        return JSON.parse(r.data)
      } catch {
        return null
      }
    })
    .filter(Boolean)

  return NextResponse.json({ events }, { headers: NO_STORE })
}
