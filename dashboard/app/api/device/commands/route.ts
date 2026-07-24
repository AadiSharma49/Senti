import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * The device side of remote control.
 *
 * Your PC sits behind NAT, so nothing can push to it — it PULLS instead. Senti
 * polls this endpoint, runs whatever is queued (through the same permission
 * dial a spoken command goes through), and PATCHes the result back so the
 * phone can show what actually happened.
 *
 * Token-authed and called from the Electron main process, so there is no CORS
 * here — same rule as the rest of /api/device.
 */
export const runtime = 'nodejs'

/** GET — claim the pending commands for this device. */
export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const pending = await prisma.deviceCommand.findMany({
    where: { deviceId: auth.device.id, state: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })

  return NextResponse.json(
    { commands: pending.map((c) => ({ id: c.id, action: c.action, args: safeArgs(c.args) })) },
    { headers: NO_STORE }
  )
}

/** PATCH — report what happened, so the phone can show the real outcome. */
export async function PATCH(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_STORE })

  const result = typeof body.result === 'string' ? body.result.slice(0, 300) : null
  const ok = body.ok !== false

  // Scoped to this device, so one machine can never edit another's commands.
  await prisma.deviceCommand.updateMany({
    where: { id, deviceId: auth.device.id },
    data: { state: ok ? 'done' : 'failed', result, ranAt: new Date() },
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

function safeArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
