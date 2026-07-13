import { NextResponse } from 'next/server'
import { dbEnabled, prisma } from './prisma'
import { hashToken } from './crypto'
import { rateLimit, clientIp, type RateLimit } from './ratelimit'

/**
 * The gate in front of every /api/device/* route.
 *
 * These endpoints serve the Senti desktop app, which makes its calls from the
 * Electron MAIN process (Node) — not from a web page. So:
 *
 *  - A legitimate request carries NO Origin header. Browsers always attach one
 *    on cross-origin requests, so we reject any request that has one. This is
 *    strictly stronger than the CORS `*` it replaces: instead of telling every
 *    website "help yourself", we tell every website "no".
 *  - Tokens are looked up by SHA-256, never compared in plaintext, so a stolen
 *    database yields no working credentials.
 *  - Everything is rate limited, so a guessed or stolen token can't be hammered.
 */

/** Per-route budgets. Chat is the expensive one (LLM + TTS), so it's tightest. */
export const LIMITS: Record<string, RateLimit> = {
  chat: { limit: 20, windowMs: 60_000 },
  greeting: { limit: 20, windowMs: 60_000 },
  policy: { limit: 60, windowMs: 60_000 },
  voiceprint: { limit: 10, windowMs: 60_000 },
  /** Unauthenticated attempts (bad/absent token) — brute-force defence. */
  reject: { limit: 30, windowMs: 60_000 },
}

function deny(error: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
}

function bearer(req: Request): string | null {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

export type DeviceAuth =
  | { ok: true; device: { id: string; userId: string; name: string } }
  | { ok: false; response: NextResponse }

/**
 * Authenticate a device request. `route` selects the rate-limit budget.
 * Returns the device, or the response to send back.
 */
export async function authenticateDevice(req: Request, route: keyof typeof LIMITS): Promise<DeviceAuth> {
  if (!dbEnabled) return { ok: false, response: deny('Accounts not configured', 503) }

  // Not callable from a web page. The desktop speaks from Node, so it has no Origin.
  if (req.headers.get('origin')) {
    return { ok: false, response: deny('Not callable from a browser', 403) }
  }

  const ip = clientIp(req)
  const token = bearer(req)

  if (!token) {
    const rl = rateLimit(`noauth:${ip}`, LIMITS.reject)
    if (!rl.ok) return { ok: false, response: deny('Too many requests', 429, { 'Retry-After': String(rl.retryAfter) }) }
    return { ok: false, response: deny('Missing device token', 401) }
  }

  // Rate limit on the token's HASH — never key a cache on a raw credential.
  const tokenHash = hashToken(token)
  const rl = rateLimit(`dev:${tokenHash}:${route}`, LIMITS[route])
  if (!rl.ok) {
    return { ok: false, response: deny('Too many requests', 429, { 'Retry-After': String(rl.retryAfter) }) }
  }

  const device = await prisma.device.findUnique({ where: { tokenHash } })
  if (!device) {
    // Failed tokens are cheap to guess only if we let them be.
    const bad = rateLimit(`badtoken:${ip}`, LIMITS.reject)
    if (!bad.ok) return { ok: false, response: deny('Too many requests', 429, { 'Retry-After': String(bad.retryAfter) }) }
    return { ok: false, response: deny('Invalid device token', 401) }
  }

  return { ok: true, device: { id: device.id, userId: device.userId, name: device.name } }
}

/** Responses from device routes are per-device and must never be cached. */
export const NO_STORE = { 'Cache-Control': 'no-store' }
