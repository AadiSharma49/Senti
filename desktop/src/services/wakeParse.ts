/**
 * Deciding whether you were talking to Senti.
 *
 * Kept apart from wakeStore on purpose: this is pure text in, decision out,
 * with no microphone, no model and no browser — so it can be tested directly,
 * which matters because a bug here is silent. Senti just doesn't answer, and
 * you're left wondering whether the mic is broken.
 *
 * The rule is deliberately loose. You should not have to remember a magic
 * phrase — "hey Senti", "wake up", "buddy", or just "hello" all work. What it
 * will NOT do is treat every sentence in the room as a command: something has
 * to be aimed at Senti, or a private conversation would be transcribed and
 * sent off to answer a question nobody asked.
 */

/** The name, plus the ways Whisper mishears it. */
const NAME_PATTERNS = [
  'senti', 'sentai', 'sente', 'sentie', 'senty', 'sensei', 'sanity', 'centi',
  'century', 'sentry', 'santi', 'shanti', 'sentio', 'sentini', 'saint e', 'sent e',
]

/** Other ways of addressing it — you don't have to use the name. */
const ADDRESS_PATTERNS = [
  'buddy', 'wake up', 'you there', 'are you there', 'listen up', 'hey buddy',
]

/**
 * Homophones that are also ordinary English. "Send it to John" must not wake
 * Senti, but "send it" alone is a plausible mishearing of the name — so these
 * only count when they are the WHOLE utterance.
 */
const BARE_ONLY_PATTERNS = ['send it', 'set me', 'sent it', 'sent me']

/** Run-up that can precede the name: "HEY Senti", "OK Senti, um, open Chrome". */
const FILLERS = ['hey', 'hi', 'hello', 'yo', 'ok', 'okay', 'um', 'uh', 'er', 'so', 'please']

/** A greeting on its own is addressed to Senti; "ok" or "um" on its own is not. */
const GREETINGS = ['hey', 'hi', 'hello', 'yo']

/**
 * Imperatives that only make sense aimed at a machine, so "hello, clean my
 * system" works without the name. Question words are deliberately absent —
 * "hello, how are you" is how you greet a person, not Senti.
 */
const COMMAND_VERBS = [
  'open', 'close', 'clean', 'delete', 'lock', 'unlock', 'mute', 'unmute',
  'launch', 'quit', 'shut', 'empty', 'free', 'turn', 'kill',
]

/** Lowercase, letters and digits only — how we compare a spoken word. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface WakeMatch {
  /** Was Senti addressed at all? */
  woke: boolean
  /** What was asked, with the address stripped off. Empty means no command. */
  command: string
}

/**
 * Split however you addressed Senti off the front of what you said.
 *
 * Matching runs on a normalized copy, but the command is sliced out of the
 * ORIGINAL text, so capitalisation and apostrophes survive into the request —
 * "what's my RAM" must not arrive as "what s my ram".
 */
export function parseWake(textRaw: string): WakeMatch {
  const words = textRaw.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { woke: false, command: '' }

  const norm = words.map(normalize)

  /** How many words of an address phrase start at `at`, or 0 for none. */
  const addressAt = (at: number): number => {
    for (const len of [3, 2, 1]) {
      const phrase = norm.slice(at, at + len).join(' ')
      if (!phrase) continue
      if (NAME_PATTERNS.includes(phrase) || ADDRESS_PATTERNS.includes(phrase)) return len
      // Ordinary-English homophones: only when nothing follows them.
      if (BARE_ONLY_PATTERNS.includes(phrase) && at + len >= norm.length) return len
    }
    return 0
  }

  // Eat the run-up and every way you addressed it: "hey senti buddy, ...".
  let i = 0
  let woke = false
  let greeted = false
  while (i < norm.length) {
    const len = addressAt(i)
    if (len) {
      i += len
      woke = true
      continue
    }
    if (FILLERS.includes(norm[i])) {
      if (GREETINGS.includes(norm[i])) greeted = true
      i++
      continue
    }
    break
  }

  const command = words.slice(i).join(' ').replace(/^[\s,.:;!?-]+/, '').trim()

  // "Hello." on its own is aimed at Senti — nothing else is left for it to be.
  if (!woke && greeted && i >= norm.length) return { woke: true, command: '' }

  // "Hello, clean my system" — an order like that is meant for the machine.
  if (!woke && greeted && COMMAND_VERBS.includes(norm[i])) return { woke: true, command }

  if (!woke) return { woke: false, command: '' }
  return { woke: true, command }
}
