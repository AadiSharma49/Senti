import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * Browsing and fetching files from one of your OTHER machines.
 *
 * "I'm out, I need that document off my PC." The target is behind NAT, so the
 * same pull model as commands: a request is queued here, the machine that owns
 * the files polls for it, does the work against a whitelist of your own
 * folders, and writes the answer back.
 *
 * Two roles share this route and they authenticate identically — every caller
 * is a device token on the same account. `deviceId` says which machine should
 * answer; omitting it means "give me MY queued work".
 */
export const runtime = 'nodejs'

/** Only these folder keys can be named; the device resolves them to real paths. */
const ROOTS = new Set(['desktop', 'documents', 'downloads', 'pictures', 'videos', 'music'])
/** Base64 inflates by ~4/3, so this is roughly a 15 MB file. */
const MAX_PAYLOAD = 20_000_000

/** POST — ask another device to list a folder or hand over a file. */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
  const kind = body.kind === 'read' ? 'read' : 'list'
  const root = typeof body.root === 'string' ? body.root : ''
  const relPath = typeof body.relPath === 'string' ? body.relPath.slice(0, 400) : ''

  if (!deviceId || deviceId === auth.device.id || !ROOTS.has(root))
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })

  const target = await prisma.device.findFirst({
    where: { id: deviceId, userId: auth.device.userId },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })

  const fr = await prisma.fileRequest.create({ data: { deviceId, kind, root, relPath } })
  return NextResponse.json({ id: fr.id }, { headers: NO_STORE })
}

/**
 * GET — two shapes:
 *   ?id=…      the asker collecting an answer
 *   (no id)    the owning machine claiming work queued for it
 */
export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const id = new URL(req.url).searchParams.get('id')

  if (id) {
    const fr = await prisma.fileRequest.findUnique({ where: { id } })
    // Scoped by account: you can only read answers meant for your own devices.
    if (!fr) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
    const dev = await prisma.device.findFirst({
      where: { id: fr.deviceId, userId: auth.device.userId },
    })
    if (!dev) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })

    // A delivered answer is deleted: file contents shouldn't linger in a
    // database after they've been handed over.
    if (fr.state !== 'pending') {
      await prisma.fileRequest.delete({ where: { id } }).catch(() => {})
    }
    return NextResponse.json(
      { state: fr.state, payload: fr.payload, error: fr.error },
      { headers: NO_STORE }
    )
  }

  const pending = await prisma.fileRequest.findMany({
    where: { deviceId: auth.device.id, state: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 3,
  })
  return NextResponse.json(
    { requests: pending.map((r) => ({ id: r.id, kind: r.kind, root: r.root, relPath: r.relPath })) },
    { headers: NO_STORE }
  )
}

/** PATCH — the owning machine returns the listing or the file. */
export async function PATCH(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const payload = typeof body.payload === 'string' ? body.payload : null
  const error = typeof body.error === 'string' ? body.error.slice(0, 200) : null
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_STORE })
  if (payload && payload.length > MAX_PAYLOAD)
    return NextResponse.json({ error: 'Too large' }, { status: 413, headers: NO_STORE })

  // Scoped to this device, so one machine can never answer another's request.
  await prisma.fileRequest.updateMany({
    where: { id, deviceId: auth.device.id, state: 'pending' },
    data: { state: error ? 'failed' : 'done', payload, error, ranAt: new Date() },
  })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
