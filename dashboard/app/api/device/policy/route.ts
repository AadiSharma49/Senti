import { NextResponse } from 'next/server'
import { dbEnabled } from '@/lib/prisma'
import { getDeviceByToken, getOrCreatePolicy, touchDevice } from '@/lib/db'

/**
 * Device policy endpoint — the desktop authenticates with its device token
 * (Authorization: Bearer <token>) and pulls its account's policy. Also
 * lets the device report its name/os/status on check-in. Token-based (no
 * Clerk session), CORS-open so the desktop can reach it.
 */
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

async function resolve(req: Request) {
  if (!dbEnabled) return { error: 'Accounts not configured', status: 503 as const }
  const token = bearer(req)
  if (!token) return { error: 'Missing device token', status: 401 as const }
  const device = await getDeviceByToken(token)
  if (!device) return { error: 'Invalid device token', status: 401 as const }
  return { device }
}

export async function GET(req: Request) {
  const r = await resolve(req)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status, headers: CORS })
  await touchDevice(r.device.id, { status: 'online' })
  const policy = await getOrCreatePolicy(r.device.userId)
  return NextResponse.json({ policy, device: { id: r.device.id, name: r.device.name } }, { headers: CORS })
}

export async function POST(req: Request) {
  const r = await resolve(req)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status, headers: CORS })
  const body = await req.json().catch(() => ({}))
  await touchDevice(r.device.id, {
    name: typeof body.name === 'string' ? body.name : undefined,
    os: typeof body.os === 'string' ? body.os : undefined,
    status: typeof body.status === 'string' ? body.status : 'online',
    voiceEnrolled: typeof body.voiceEnrolled === 'boolean' ? body.voiceEnrolled : undefined,
  })
  const policy = await getOrCreatePolicy(r.device.userId)
  return NextResponse.json({ policy }, { headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
