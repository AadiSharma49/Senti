import { NextResponse } from 'next/server'
import { dbEnabled } from '@/lib/prisma'
import { getDeviceByToken, getVoiceprint, upsertVoiceprint, touchDevice } from '@/lib/db'

/**
 * Device voiceprint sync (token-authed). The desktop uploads the
 * voiceprint it captured on-device (POST) and a newly-linked device
 * downloads the account's voiceprint (GET). Embedding is a JSON array of
 * numbers; audio never touches this.
 */
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function bearer(req: Request): string | null {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
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
  const vp = await getVoiceprint(r.device.userId)
  return NextResponse.json({ profile: vp }, { headers: CORS })
}

export async function POST(req: Request) {
  const r = await resolve(req)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status, headers: CORS })

  const body = await req.json().catch(() => null)
  const embedding = Array.isArray(body?.embedding) ? (body.embedding as number[]) : null
  if (!embedding || embedding.length === 0) {
    return NextResponse.json({ error: 'Missing embedding' }, { status: 400, headers: CORS })
  }

  await upsertVoiceprint(r.device.userId, {
    embedding,
    phrase: typeof body.phrase === 'string' ? body.phrase : '',
    sampleCount: Number.isFinite(body.sampleCount) ? body.sampleCount : 0,
    modelId: typeof body.modelId === 'string' ? body.modelId : 'unknown',
  })
  await touchDevice(r.device.id, { voiceEnrolled: true, status: 'locked' })

  return NextResponse.json({ ok: true }, { headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
