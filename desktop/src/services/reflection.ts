import { askSenti, type ChatTurn } from './assistantService'
import type { ActivityBucket } from '../vite-env'

/**
 * How Senti gets to know you without being told.
 *
 * Until now its memory only held what you explicitly said to remember. That's
 * not how knowing someone works — a friend doesn't need you to announce your
 * habits, they just notice over weeks.
 *
 * So: every so often Senti reads back its own activity journal, works out what
 * is genuinely TRUE and DURABLE about you, and writes those few things to
 * memory. Next time you talk, it already knows.
 *
 * The two failure modes this guards against:
 *   - Recording noise as insight ("used Chrome on Tuesday" is not a fact about
 *     a person), handled by only reflecting on enough accumulated time.
 *   - Endless near-duplicates, handled by sending existing memories along and
 *     asking only for what's genuinely new.
 */
const REFLECT_EVERY_MS = 6 * 60 * 60_000
/** Below this there isn't enough signal to say anything true about someone. */
const MIN_MINUTES = 90
const STAMP_KEY = 'senti:lastReflectionAt'

function lastReflection(): number {
  try {
    return Number(localStorage.getItem(STAMP_KEY) || 0)
  } catch {
    return 0
  }
}

function markReflected(): void {
  try {
    localStorage.setItem(STAMP_KEY, String(Date.now()))
  } catch {
    // storage unavailable — we'll just reflect again next launch
  }
}

/** Roll the journal into a few readable lines: app, total hours, when. */
export function summarizeActivity(buckets: ActivityBucket[]): string {
  if (!buckets.length) return ''
  const byApp = new Map<string, { minutes: number; parts: Map<string, number>; samples: Set<string> }>()

  for (const b of buckets) {
    let e = byApp.get(b.process)
    if (!e) {
      e = { minutes: 0, parts: new Map(), samples: new Set() }
      byApp.set(b.process, e)
    }
    e.minutes += b.minutes
    e.parts.set(b.part, (e.parts.get(b.part) ?? 0) + b.minutes)
    for (const s of b.samples) if (e.samples.size < 4) e.samples.add(s)
  }

  return [...byApp.entries()]
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 10)
    .map(([proc, e]) => {
      const hours = (e.minutes / 60).toFixed(1)
      const when = [...e.parts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
      const samples = [...e.samples].slice(0, 2).join('; ')
      return `- ${proc}: ${hours}h total, mostly ${when}${samples ? ` (e.g. ${samples})` : ''}`
    })
    .join('\n')
}

/** Total tracked minutes, to decide whether there's enough to learn from. */
function totalMinutes(buckets: ActivityBucket[]): number {
  return buckets.reduce((n, b) => n + b.minutes, 0)
}

/**
 * Read the journal, decide what's newly true about this person, and remember
 * it. Safe to call often; it only does real work on its own schedule.
 */
export async function reflect(force = false): Promise<string[]> {
  if (!force && Date.now() - lastReflection() < REFLECT_EVERY_MS) return []

  const buckets = (await window.senti?.activityList?.()) ?? []
  if (totalMinutes(buckets) < MIN_MINUTES) return []

  const summary = summarizeActivity(buckets)
  if (!summary) return []

  const known = ((await window.senti?.memoryList?.()) ?? []).map((m) => m.text)
  markReflected()

  const prompt =
    `[Internal reflection — the user is NOT present and will not hear this. Below is how they ` +
    `actually spent time on this computer over the last few weeks, aggregated.\n\n${summary}\n\n` +
    (known.length ? `You already know:\n${known.map((k) => `- ${k}`).join('\n')}\n\n` : '') +
    `Write at most 3 NEW durable facts about this person that these patterns genuinely support — ` +
    `their routine, what they work on, what they play, when they're active. Skip anything you ` +
    `already know and anything that's just noise. One fact per line, no numbering, no preamble. ` +
    `If nothing new is genuinely supported, reply with exactly: NONE]`

  const turns: ChatTurn[] = [{ role: 'user', content: prompt }]
  const reply = await askSenti(turns, 'en-US', null)
  const text = (reply.text || '').trim()
  if (!text || /^none\b/i.test(text)) return []

  const facts = text
    .split('\n')
    .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
    .filter((l) => l.length > 8 && l.length < 200)
    .slice(0, 3)

  for (const f of facts) await window.senti?.memoryAdd?.(f)
  return facts
}

/** What Senti has noticed about your habits, for conversation context. */
export async function habitsContext(): Promise<string> {
  const buckets = (await window.senti?.activityList?.()) ?? []
  if (totalMinutes(buckets) < 30) return ''
  const summary = summarizeActivity(buckets)
  return summary ? `How they've actually been spending time on this PC lately:\n${summary}` : ''
}
