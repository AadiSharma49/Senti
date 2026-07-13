/**
 * Rate limiting for the device API.
 *
 * Without this, a stolen or guessed token can be replayed without limit, and
 * the expensive routes (chat -> LLM + TTS) are a free money-burn for anyone
 * who finds them.
 *
 * In-memory + per-instance. That's honest about what it is: it stops abuse
 * and brute force from a single client, but a serverless deploy runs several
 * instances, so it is a speed bump, not a distributed quota. Move to Redis
 * (Upstash) when traffic justifies it.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Keep the map from growing without bound on a long-lived instance.
let lastSweep = Date.now()
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  buckets.forEach((b, k) => {
    if (b.resetAt <= now) buckets.delete(k)
  })
}

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number
  /** Window length, ms. */
  windowMs: number
}

export interface RateResult {
  ok: boolean
  remaining: number
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number
}

/** Count a hit against `key`. Returns whether it is allowed. */
export function rateLimit(key: string, { limit, windowMs }: RateLimit): RateResult {
  const now = Date.now()
  sweep(now)

  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }

  b.count++
  const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
  if (b.count > limit) return { ok: false, remaining: 0, retryAfter }
  return { ok: true, remaining: limit - b.count, retryAfter }
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
