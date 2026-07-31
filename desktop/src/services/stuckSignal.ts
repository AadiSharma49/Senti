/**
 * Spotting that someone is stuck, from behaviour alone.
 *
 * Senti doesn't read your screen, so it can't see that you died to the same
 * boss ten times. But being stuck has a SHAPE, and that shape is visible from
 * window titles:
 *
 *   - one title held for a very long unbroken stretch. In a game the title
 *     usually carries the level or mission, so an unchanged one for 35 minutes
 *     genuinely suggests you're repeating something.
 *   - churn: returning to the same thing again and again with trips elsewhere
 *     in between — the universal shape of looking something up because you're
 *     stuck on it.
 *
 * Both are circumstantial, which is why the caller phrases the result as a
 * question. An assistant that ANNOUNCES you're stuck when you're merely
 * concentrating is worse than one that stays quiet.
 *
 * Kept separate from the proactive loop so the thresholds can be tested
 * without a desktop, a microphone or a clock.
 */

export const STUCK_DWELL_MS = 35 * 60_000
export const STUCK_VISITS = 4
export const STUCK_TOTAL_MS = 20 * 60_000
/** Visit history older than this says nothing about right now. */
export const VISIT_WINDOW_MS = 90 * 60_000

/** How much attention one window has had, and how often you've come back. */
export interface Attention {
  visits: number
  totalMs: number
  lastSeen: number
}

/** Record that focus landed here, and forget windows from too long ago. */
export function noteVisit(attention: Map<string, Attention>, key: string, now: number): void {
  const a = attention.get(key)
  if (a) {
    a.visits++
    a.lastSeen = now
  } else {
    attention.set(key, { visits: 1, totalMs: 0, lastSeen: now })
  }
  for (const [k, v] of attention) {
    if (now - v.lastSeen > VISIT_WINDOW_MS) attention.delete(k)
  }
}

/** Add elapsed time to the window currently in focus. */
export function noteDwell(attention: Map<string, Attention>, key: string, ms: number, now: number): void {
  const a = attention.get(key)
  if (!a) return
  a.totalMs += ms
  a.lastSeen = now
}

/**
 * Does this look like being stuck? Either a very long unbroken stretch, or
 * repeated returns totalling real time.
 */
export function looksStuck(
  attention: Map<string, Attention>,
  key: string,
  dwellMs: number,
  now: number
): boolean {
  if (dwellMs > STUCK_DWELL_MS) return true
  const a = attention.get(key)
  if (!a) return false
  return a.visits >= STUCK_VISITS && a.totalMs > STUCK_TOTAL_MS && now - a.lastSeen < VISIT_WINDOW_MS
}
