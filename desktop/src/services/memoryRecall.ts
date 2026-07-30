/**
 * Picking which memories are worth sending.
 *
 * Sending all of them worked at ten and breaks at a hundred: the prompt grows
 * without limit, and the things that actually matter get buried among facts
 * about something else entirely.
 *
 * This ranks by word overlap with what was just said, weighting rare words
 * over common ones — a plain TF-IDF-ish score. It is LEXICAL, not semantic:
 * it will match "drive" to "drive" but not to "disk". True semantic search
 * needs an embedding model, which is a real addition (another bundled ONNX
 * model, more startup cost); this gets most of the benefit for none of that,
 * and the interface below won't change when it's worth upgrading.
 */

/** Words too common to say anything about which memory is relevant. */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'my', 'me', 'i', 'you', 'your',
  'it', 'its', 'this', 'that', 'these', 'those', 'do', 'does', 'did', 'can',
  'could', 'would', 'should', 'will', 'what', 'when', 'where', 'who', 'how',
  'not', 'no', 'yes', 'so', 'if', 'then', 'than', 'as', 'about', 'from', 'up',
  'out', 'get', 'got', 'have', 'has', 'had', 'user', 'users',
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

/**
 * The most relevant memories for `query`, most relevant first.
 *
 * Recent memories get a small nudge, so that when nothing clearly matches you
 * get what Senti learned most recently rather than an arbitrary slice.
 */
export function rankMemories(
  memories: { text: string; createdAt?: number }[],
  query: string,
  limit = 12
): string[] {
  if (memories.length <= limit) return memories.map((m) => m.text)

  const q = tokens(query)
  if (!q.length) return memories.slice(-limit).map((m) => m.text)

  // How many memories each word appears in — a word in most of them tells us
  // nothing, so it's worth proportionally less.
  const docFreq = new Map<string, number>()
  const docs = memories.map((m) => {
    const t = new Set(tokens(m.text))
    for (const w of t) docFreq.set(w, (docFreq.get(w) ?? 0) + 1)
    return t
  })

  const now = Date.now()
  const scored = memories.map((m, i) => {
    let score = 0
    for (const w of q) {
      if (!docs[i].has(w)) continue
      const df = docFreq.get(w) ?? 1
      score += Math.log(1 + memories.length / df)
    }
    // Slight preference for newer facts when scores are otherwise close.
    const ageDays = m.createdAt ? (now - m.createdAt) / 86_400_000 : 60
    score += Math.max(0, 1 - ageDays / 90) * 0.25
    return { text: m.text, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.text)
}
