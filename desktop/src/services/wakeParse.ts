/**
 * Deciding whether you were talking to Senti.
 *
 * Kept apart from wakeStore on purpose: this is pure text in, decision out,
 * with no microphone, no model and no browser — so it can be tested directly,
 * which matters because a bug here is silent. Senti just doesn't answer, and
 * you're left wondering whether the mic is broken.
 */

/** Whisper mishears the name in predictable ways; accept the near-misses. */
const WAKE_PATTERNS = [
  'senti', 'sentai', 'sente', 'sentie', 'senty', 'sensei', 'sanity', 'centi',
  'century', 'sentry', 'santi', 'shanti', 'sentio', 'sentini', 'saint e', 'sent e',
]

/**
 * Homophones that are also ordinary English. "Send it to John" must not wake
 * Senti, but "send it" alone is a plausible mishearing of the name — so these
 * only count when they are the WHOLE utterance.
 */
const BARE_ONLY_PATTERNS = ['send it', 'set me', 'sent it', 'sent me']

/**
 * Nobody says "Senti, open Chrome" — they say "HEY Senti, open Chrome". The
 * name almost never starts the sentence, so skip the run-up first.
 */
const LEAD_FILLERS = ['hey', 'hi', 'hello', 'ok', 'okay', 'yo', 'um', 'uh', 'er', 'so']

/** Lowercase, letters and digits only — how we compare a spoken word. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface WakeMatch {
  /** Was Senti addressed at all? */
  woke: boolean
  /** What was asked, with the name stripped off. Empty means just the name. */
  command: string
}

/**
 * Split the wake word off the front of what was heard.
 *
 * Matching runs on a normalized copy, but the command is sliced out of the
 * ORIGINAL text, so capitalisation and apostrophes survive into the request —
 * "what's my RAM" must not arrive as "what s my ram".
 */
export function parseWake(textRaw: string): WakeMatch {
  const words = textRaw.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { woke: false, command: '' }

  const norm = words.map(normalize)

  // Step over "hey", "ok", "um"… but never the entire utterance, or a lone
  // "hey" would look like a wake with an empty command.
  let i = 0
  while (i < norm.length - 1 && LEAD_FILLERS.includes(norm[i])) i++

  const rest = () => words.slice(i).join(' ').replace(/^[\s,.:;!?-]+/, '').trim()

  // One-word names, then two-word mishearings ("saint e").
  for (const len of [1, 2]) {
    const candidate = norm.slice(i, i + len).join(' ')
    if (!candidate) continue

    if (WAKE_PATTERNS.includes(candidate)) {
      i += len
      return { woke: true, command: rest() }
    }

    // Ordinary-English homophones: only when nothing follows them.
    if (BARE_ONLY_PATTERNS.includes(candidate) && i + len >= norm.length) {
      return { woke: true, command: '' }
    }
  }

  return { woke: false, command: '' }
}
