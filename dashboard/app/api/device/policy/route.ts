import { NextResponse } from 'next/server'
import { touchDevice, DeviceConflictError } from '@/lib/db'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { hashToken } from '@/lib/crypto'

/**
 * Device check-in endpoint — the desktop authenticates with its device token
 * and reports its name/os/status on a heartbeat.
 *
 * Called from the desktop's Electron main process, never a browser, so there
 * is no CORS here by design (see lib/deviceAuth.ts).
 */
export const runtime = 'nodejs'

/** A device reports its own name/os; keep them short so nothing runs away. */
const str = (v: unknown, max = 120): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response
  const { device } = auth

  await touchDevice(device.id, { status: 'online' })
  return NextResponse.json({ device: { id: device.id, name: device.name } }, { headers: NO_STORE })
}

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response
  const { device } = auth

  const body = await req.json().catch(() => ({}))
  const status = str(body.status, 20)
  const hardwareId = str(body.hardwareId, 200)

  try {
    await touchDevice(device.id, {
      name: str(body.name),
      os: str(body.os, 40),
      status: status && ['online', 'offline'].includes(status) ? status : 'online',
      hardwareIdHash: hardwareId ? hashToken(hardwareId) : undefined,
    })
  } catch (err) {
    if (err instanceof DeviceConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409, headers: NO_STORE })
    }
    throw err
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
