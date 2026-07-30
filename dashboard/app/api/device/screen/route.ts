import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * The PC pushes its latest screen frame here so you can watch it live from your
 * phone or laptop. Token-authed (called from the Electron main process), like
 * the rest of /api/device.
 *
 * We keep only the newest frame per device — this is a live view, never a
 * recording. Frames are already downscaled on the PC before upload.
 */
export const runtime = 'nodejs'

/** ~500 KB ceiling on a single frame, so a bad client can't dump huge blobs. */
const MAX_FRAME_CHARS = 500_000

/** POST — store the newest frame (and whether the PC is still sharing). */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const data = typeof body.data === 'string' ? body.data : ''
  const sharing = body.sharing !== false

  if (!data.startsWith('data:image') || data.length > MAX_FRAME_CHARS)
    return NextResponse.json({ error: 'Bad frame' }, { status: 400, headers: NO_STORE })

  await prisma.screenFrame.upsert({
    where: { deviceId: auth.device.id },
    create: { deviceId: auth.device.id, data, sharing },
    update: { data, sharing },
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

/** DELETE — the PC stopped sharing; mark the feed cold (keep the last frame). */
export async function DELETE(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  await prisma.screenFrame.updateMany({
    where: { deviceId: auth.device.id },
    data: { sharing: false },
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
