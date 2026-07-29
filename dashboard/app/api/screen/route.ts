import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled, prisma } from '@/lib/prisma'

/**
 * The phone/laptop side of the live screen view: read the newest frame for one
 * of YOUR devices. Clerk-authed (a browser call) and scoped to the signed-in
 * user's own devices — you can never watch someone else's machine.
 */
export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!clerkEnabled || !dbEnabled)
    return NextResponse.json({ error: 'Accounts not configured' }, { status: 503 })
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deviceId = new URL(req.url).searchParams.get('deviceId') || ''
  // Ownership check: the device must belong to the signed-in user.
  const device = await prisma.device.findFirst({ where: { id: deviceId, userId } })
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const frame = await prisma.screenFrame.findUnique({ where: { deviceId } })
  if (!frame) return NextResponse.json({ frame: null, sharing: false })

  // Stale after ~10s of no new frame — the PC likely stopped or slept.
  const fresh = Date.now() - new Date(frame.updatedAt).getTime() < 10_000
  return NextResponse.json(
    { frame: frame.data, sharing: frame.sharing && fresh, updatedAt: frame.updatedAt },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
