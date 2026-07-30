import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * WebRTC signalling: the two machines exchanging enough information to find
 * each other directly.
 *
 * This is a mailbox, not a pipe. Once the handshake completes, the screen
 * video and your input travel peer-to-peer and never come back through here —
 * so the server sees the introduction and nothing else. That's the whole point
 * of moving to WebRTC: it's both dramatically faster than relaying frames
 * through a database, and the content stops passing through our infrastructure
 * at all.
 *
 * Each side only ever reads the OTHER side's messages, and a message is
 * deleted the moment it's collected — a consumed handshake is worthless and
 * keeping it would only be a leak waiting to happen.
 */
export const runtime = 'nodejs'

/** SDP blobs are big-ish; ICE candidates are small. This covers both. */
const MAX_PAYLOAD = 20_000

/** Confirm the caller is part of this session, and say which end they are. */
async function endpointFor(sessionId: string, deviceId: string, userId: string) {
  const session = await prisma.remoteSession.findFirst({
    where: { id: sessionId, userId, state: 'active' },
  })
  if (!session) return null
  if (session.viewerDeviceId === deviceId) return { session, isViewer: true }
  if (session.targetDeviceId === deviceId) return { session, isViewer: false }
  return null
}

/** POST — leave a message for the other end. */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body.id === 'string' ? body.id : ''
  const kind = typeof body.kind === 'string' ? body.kind : ''
  const payload = typeof body.payload === 'string' ? body.payload : ''
  if (!sessionId || !['offer', 'answer', 'ice'].includes(kind) || !payload || payload.length > MAX_PAYLOAD)
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })

  const end = await endpointFor(sessionId, auth.device.id, auth.device.userId)
  if (!end) return NextResponse.json({ error: 'No active session' }, { status: 403, headers: NO_STORE })

  await prisma.remoteSignal.create({
    data: { sessionId, fromViewer: end.isViewer, kind, payload },
  })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

/** GET — collect everything the other end left, oldest first, then forget it. */
export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const sessionId = new URL(req.url).searchParams.get('id') || ''
  const end = await endpointFor(sessionId, auth.device.id, auth.device.userId)
  if (!end) return NextResponse.json({ signals: [] }, { headers: NO_STORE })

  // Mine are the ones the OTHER side sent.
  const rows = await prisma.remoteSignal.findMany({
    where: { sessionId, fromViewer: !end.isViewer },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  if (rows.length) {
    await prisma.remoteSignal.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  }

  return NextResponse.json(
    { signals: rows.map((r) => ({ kind: r.kind, payload: r.payload })) },
    { headers: NO_STORE }
  )
}
