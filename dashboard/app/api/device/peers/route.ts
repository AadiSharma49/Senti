import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * Device-to-device control: your LAPTOP's Senti seeing and commanding your PC.
 *
 * The dashboard already does this from a browser (Clerk-authed). This is the
 * same capability for the desktop app itself, authed by device token — so the
 * software shows the same "My Devices" view the website does, and any of your
 * machines can queue a command on any OTHER of your machines.
 *
 * Scoping is the whole security story here: a device may only ever see and
 * command devices belonging to the SAME account. There is no path to another
 * user's hardware.
 */
export const runtime = 'nodejs'

/** Same remote-action set the phone dashboard is allowed to queue. */
const ALLOWED = new Set([
  'open_app', 'close_app', 'clean_temp', 'empty_recycle_bin',
  'lock_workstation', 'power', 'set_volume', 'screen_share',
])

/** GET — every device on this account, newest report first; `self` marks the caller. */
export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const devices = await prisma.device.findMany({
    where: { userId: auth.device.userId },
    orderBy: { lastSeen: 'desc' },
  })

  return NextResponse.json(
    {
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        os: d.os,
        self: d.id === auth.device.id,
        status: d.status,
        activity: d.activity,
        vitals: d.vitals,
        reportedAt: d.reportedAt,
        lastSeen: d.lastSeen,
      })),
    },
    { headers: NO_STORE }
  )
}

/** POST — queue a command on a SIBLING device (same account, never yourself). */
export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
  const action = typeof body.action === 'string' ? body.action : ''
  if (!deviceId || !ALLOWED.has(action))
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })
  // Commanding yourself through the cloud would just be a slower local call.
  if (deviceId === auth.device.id)
    return NextResponse.json({ error: 'Target is this device' }, { status: 400, headers: NO_STORE })

  const target = await prisma.device.findFirst({
    where: { id: deviceId, userId: auth.device.userId },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })

  // Same arg filtering as the dashboard's command route.
  const args: Record<string, string | boolean> = {}
  if (typeof body.name === 'string') args.name = body.name.slice(0, 60)
  if (typeof body.direction === 'string') args.direction = body.direction.slice(0, 10)
  if (typeof body.mode === 'string') args.mode = body.mode.slice(0, 20)
  if (typeof body.on === 'boolean') args.on = body.on

  const cmd = await prisma.deviceCommand.create({
    data: { deviceId, action, args: JSON.stringify(args) },
  })

  return NextResponse.json({ id: cmd.id, queued: true }, { headers: NO_STORE })
}
