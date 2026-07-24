import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled, prisma } from '@/lib/prisma'

/**
 * The phone side of remote control: queue a command for one of YOUR machines.
 *
 * Clerk-authed (this is a browser call, unlike /api/device/*), and every write
 * is scoped to the signed-in user's own devices — you can never queue work on
 * someone else's PC.
 */
export const runtime = 'nodejs'

/** Only these can be requested remotely; the desktop enforces its own list too. */
const ALLOWED = new Set(['open_app', 'close_app', 'clean_temp', 'empty_recycle_bin', 'lock_workstation', 'set_volume'])

export async function POST(req: Request) {
  if (!clerkEnabled || !dbEnabled)
    return NextResponse.json({ error: 'Accounts not configured' }, { status: 503 })
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
  const action = typeof body.action === 'string' ? body.action : ''
  if (!deviceId || !ALLOWED.has(action))
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  // The device must belong to the signed-in user.
  const device = await prisma.device.findFirst({ where: { id: deviceId, userId } })
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only pass through arguments we understand.
  const args: Record<string, string> = {}
  if (typeof body.name === 'string') args.name = body.name.slice(0, 60)
  if (typeof body.direction === 'string') args.direction = body.direction.slice(0, 10)

  const cmd = await prisma.deviceCommand.create({
    data: { deviceId, action, args: JSON.stringify(args) },
  })

  return NextResponse.json({ id: cmd.id, queued: true })
}

/** Recent commands for a device, so the phone can show what happened. */
export async function GET(req: Request) {
  if (!clerkEnabled || !dbEnabled)
    return NextResponse.json({ error: 'Accounts not configured' }, { status: 503 })
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deviceId = new URL(req.url).searchParams.get('deviceId') || ''
  const device = await prisma.device.findFirst({ where: { id: deviceId, userId } })
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const commands = await prisma.deviceCommand.findMany({
    where: { deviceId },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  return NextResponse.json({
    commands: commands.map((c) => ({
      id: c.id,
      action: c.action,
      state: c.state,
      result: c.result,
      createdAt: c.createdAt,
    })),
  })
}
