import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * A device watching a SIBLING device's live screen — the laptop's Senti
 * showing the PC's desktop. Mirror of /api/screen (the browser viewer), but
 * device-token authed and scoped the same way: same account only.
 */
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const deviceId = new URL(req.url).searchParams.get('deviceId') || ''
  const target = await prisma.device.findFirst({
    where: { id: deviceId, userId: auth.device.userId },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })

  const frame = await prisma.screenFrame.findUnique({ where: { deviceId } })
  if (!frame) return NextResponse.json({ frame: null, sharing: false }, { headers: NO_STORE })

  // Stale after ~10s of no new frame — the PC likely stopped or slept.
  const fresh = Date.now() - new Date(frame.updatedAt).getTime() < 10_000
  return NextResponse.json(
    { frame: frame.data, sharing: frame.sharing && fresh, updatedAt: frame.updatedAt },
    { headers: NO_STORE }
  )
}
