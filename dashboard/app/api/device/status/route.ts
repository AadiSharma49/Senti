import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * Live status the desktop pushes so you can check your machine from your phone.
 *
 * The desktop POSTs what Senti is doing right now plus a compact vitals line;
 * the mobile dashboard reads it. Token-authed, called from the Electron main
 * process (never a browser) — so no CORS, same as the rest of /api/device.
 */
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'policy') // reuse the policy budget
  if (!auth.ok) return auth.response
  const { device } = auth

  const body = await req.json().catch(() => ({}))
  const activity = typeof body.activity === 'string' ? body.activity.slice(0, 200) : null
  const vitals = typeof body.vitals === 'string' ? body.vitals.slice(0, 400) : null
  const status = typeof body.status === 'string' ? body.status.slice(0, 20) : 'online'

  await prisma.device.update({
    where: { id: device.id },
    data: {
      activity,
      vitals,
      status: ['online', 'working', 'idle', 'offline'].includes(status) ? status : 'online',
      reportedAt: new Date(),
      lastSeen: new Date(),
    },
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
