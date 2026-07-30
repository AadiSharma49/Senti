import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * The shared clipboard: copy on one of your machines, paste on another.
 *
 * One row per account holding only the LATEST copy — overwritten every time,
 * never a history. Each device polls GET and applies anything newer that came
 * from a DIFFERENT device (`mine` tells it whose copy this is, so a writer
 * never echoes its own update back onto its own clipboard).
 *
 * Text only, capped. Same trust boundary as everything else under /api/device:
 * token-authed, scoped to the account, no browser access.
 */
export const runtime = 'nodejs'

/** Plenty for prose and code, small enough to move fast. */
const MAX_TEXT = 100_000

export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const clip = await prisma.sharedClipboard.findUnique({ where: { userId: auth.device.userId } })
  if (!clip) return NextResponse.json({ text: null }, { headers: NO_STORE })

  return NextResponse.json(
    {
      text: clip.text,
      mine: clip.fromDeviceId === auth.device.id,
      from: clip.fromName,
      updatedAt: clip.updatedAt,
    },
    { headers: NO_STORE }
  )
}

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'stream')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : ''
  if (!text.trim()) return NextResponse.json({ error: 'Empty' }, { status: 400, headers: NO_STORE })

  await prisma.sharedClipboard.upsert({
    where: { userId: auth.device.userId },
    create: {
      userId: auth.device.userId,
      text,
      fromDeviceId: auth.device.id,
      fromName: auth.device.name,
    },
    update: { text, fromDeviceId: auth.device.id, fromName: auth.device.name },
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
