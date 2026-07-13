import { NextResponse } from 'next/server'
import { getOrCreatePolicy, touchDevice } from '@/lib/db'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * Device policy endpoint — the desktop authenticates with its device token and
 * pulls its account's policy, and reports its name/os/status on check-in.
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
  const policy = await getOrCreatePolicy(device.userId)
  return NextResponse.json(
    { policy, device: { id: device.id, name: device.name } },
    { headers: NO_STORE }
  )
}

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy')
  if (!auth.ok) return auth.response
  const { device } = auth

  const body = await req.json().catch(() => ({}))
  const status = str(body.status, 20)
  await touchDevice(device.id, {
    name: str(body.name),
    os: str(body.os, 40),
    status: status && ['online', 'locked', 'offline'].includes(status) ? status : 'online',
    voiceEnrolled: typeof body.voiceEnrolled === 'boolean' ? body.voiceEnrolled : undefined,
  })
  const policy = await getOrCreatePolicy(device.userId)
  return NextResponse.json({ policy }, { headers: NO_STORE })
}
