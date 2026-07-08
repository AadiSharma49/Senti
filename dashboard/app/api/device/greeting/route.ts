import { NextResponse } from 'next/server'
import { dbEnabled, prisma } from '@/lib/prisma'
import { getDeviceByToken } from '@/lib/db'
import { generateGreeting } from '@/lib/greeting'

/**
 * Device greeting endpoint — the desktop authenticates with its device token
 * and gets a fresh spoken greeting to play on unlock. The Anthropic key stays
 * server-side; the desktop only ever receives the finished greeting text.
 */
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function bearer(req: Request): string | null {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

export async function GET(req: Request) {
  if (!dbEnabled) return NextResponse.json({ error: 'Accounts not configured' }, { status: 503, headers: CORS })
  const token = bearer(req)
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401, headers: CORS })
  const device = await getDeviceByToken(token)
  if (!device) return NextResponse.json({ error: 'Invalid device token' }, { status: 401, headers: CORS })

  const user = await prisma.user.findUnique({ where: { id: device.userId } })
  const name = user?.name || user?.email?.split('@')[0] || null
  const greeting = await generateGreeting({ name, deviceName: device.name })

  return NextResponse.json({ greeting }, { headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
