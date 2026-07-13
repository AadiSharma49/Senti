import { NextResponse } from 'next/server'
import { getVoiceprint, upsertVoiceprint, touchDevice } from '@/lib/db'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

/**
 * Device voiceprint sync (token-authed). The desktop uploads the voiceprint it
 * captured on-device (POST); a newly-linked device downloads the account's
 * voiceprint (GET). Raw audio never touches this — only the embedding, which
 * is encrypted at rest (lib/crypto.ts).
 *
 * Called from the desktop's Electron main process, never a browser, so there
 * is no CORS here by design (see lib/deviceAuth.ts).
 */
export const runtime = 'nodejs'

/** The speaker model emits 256 floats; anything else is not a voiceprint. */
const MAX_DIMS = 1024

export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'voiceprint')
  if (!auth.ok) return auth.response

  const vp = await getVoiceprint(auth.device.userId)
  return NextResponse.json({ profile: vp }, { headers: NO_STORE })
}

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'voiceprint')
  if (!auth.ok) return auth.response
  const { device } = auth

  const body = await req.json().catch(() => null)
  const raw = Array.isArray(body?.embedding) ? (body.embedding as unknown[]) : null

  // Validate hard: this is what decides who can unlock a machine.
  const embedding =
    raw && raw.length > 0 && raw.length <= MAX_DIMS && raw.every((n) => typeof n === 'number' && Number.isFinite(n))
      ? (raw as number[])
      : null

  if (!embedding) {
    return NextResponse.json({ error: 'Invalid embedding' }, { status: 400, headers: NO_STORE })
  }

  await upsertVoiceprint(device.userId, {
    embedding,
    sampleCount: Number.isFinite(body.sampleCount) ? Math.min(Number(body.sampleCount), 100) : 0,
    modelId: typeof body.modelId === 'string' ? body.modelId.slice(0, 80) : 'unknown',
  })
  await touchDevice(device.id, { voiceEnrolled: true, status: 'locked' })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
