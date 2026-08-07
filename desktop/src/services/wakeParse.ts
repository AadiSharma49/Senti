/**
 * Deciding whether you were talking to Senti.
 *
 * Kept apart from wakeStore on purpose: this is pure text in, decision out,
 * with no microphone, no model and no browser — so it can be tested directly,
 * which matters because a bug here is silent. Senti just doesn't answer, and
 * you're left wondering whether the mic is broken.
 *
 * The rule is deliberately loose. You should not have to remember a magic
 * phrase — "hey Senti", "wake up", "buddy", or just "hello" all work, and a
 * plain order like "open Chrome" or "can you clean my system" works with no
 * address at all, because nobody says that to a person in the room.
 *
 * What it will NOT do is answer ordinary questions or chit-chat without being
 * addressed — "how are you", "what time is it" — or a private conversation
 * would be transcribed and sent off to answer something nobody asked Senti.
 */

/** The name, plus the ways Whisper mishears it. */
const NAME_PATTERNS = [
  'senti', 'sentai', 'sente', 'sentie', 'senty', 'sensei', 'sanity', 'centi',
  'century', 'sentry', 'santi', 'shanti', 'sentio', 'sentini', 'saint e', 'sent e',
]

/** Other ways of addressing it — you don't have to use the name. */
const ADDRESS_PATTERNS = [
  'buddy', 'bro', 'mate', 'wake up', 'you there', 'are you there', 'listen up', 'hey buddy',
]

/**
 * Phrases that are ONLY ever said to a listener.
 *
 * "Can you hear me" is the first thing anyone says to test an assistant, and
 * it did nothing: politeness stripping left "hear me", which isn't a command
 * verb, so Senti stayed silent while the Control Center cheerfully displayed
 * the words it had just heard. Nobody says these to themselves — if one is
 * spoken, it was spoken TO something.
 */
const DIRECT_ADDRESS = [
  'can you hear me', 'do you hear me', 'can u hear me', 'hear me',
  'are you listening', 'you listening', 'are you awake', 'you awake',
  'are you working', 'you working', 'can you understand me',
]

/**
 * Homophones that are also ordinary English. "Send it to John" must not wake
 * Senti, but "send it" alone is a plausible mishearing of the name — so these
 * only count when they are the WHOLE utterance.
 */
const BARE_ONLY_PATTERNS = ['send it', 'set me', 'sent it', 'sent me']

/**
 * Run-up that can precede the name: "HEY Senti", "OK Senti, um, open Chrome".
 *
 * Non-English greetings are here too, because transcription already handles
 * any language — Whisper auto-detects — so the only thing standing between a
 * Hindi or Spanish speaker and a working assistant was this list. Addressing
 * Senti by name works in every language; bare imperatives ("open Chrome" with
 * no name) are still English-only, since those verbs are matched literally.
 */
const FILLERS = [
  'hey', 'hi', 'hello', 'yo', 'ok', 'okay', 'um', 'uh', 'er', 'so', 'please',
  // hi / es / fr / de / pt / ja / zh / ar / ru
  'namaste', 'namaskar', 'suno', 'arre',
  'hola', 'oye', 'bonjour', 'salut', 'hallo', 'olá', 'ola',
  'moshi', 'konnichiwa', 'nihao', 'wei',
  'marhaba', 'salam', 'privet', 'zdravstvuyte',
]

/** A greeting on its own is addressed to Senti; "ok" or "um" on its own is not. */
const GREETINGS = [
  'hey', 'hi', 'hello', 'yo',
  'namaste', 'namaskar', 'hola', 'oye', 'bonjour', 'salut', 'hallo',
  'olá', 'ola', 'konnichiwa', 'nihao', 'marhaba', 'salam', 'privet',
]

/**
 * Polite wrappers people put in front of a command: "CAN YOU open Chrome",
 * "COULD YOU clean my system". Stripped so what's left starts with the verb.
 */
const POLITE_LEADS = [
  'can you', 'could you', 'would you', 'will you', 'can u', 'could u',
  'i want to', 'i need to', 'i want you to', 'i need you to', 'lets', "let's", 'go',
]

/**
 * Imperatives that only make sense aimed at a machine. A sentence that STARTS
 * with one of these is treated as a command even with no address — "open
 * Chrome", "lock my PC". Question words are deliberately absent: "how are you"
 * and "what time is it" are chit-chat and stay ignored unless Senti is named.
 */
const COMMAND_VERBS = [
  'open', 'close', 'clean', 'delete', 'lock', 'unlock', 'mute', 'unmute',
  'launch', 'quit', 'shut', 'empty', 'free', 'turn', 'kill', 'restart',
  'reboot', 'minimize', 'maximize', 'pull', 'bring',
]

/** Lowercase, letters and digits only — how we compare a spoken word. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Phrases that dismiss Senti while it's dormant — "close", "shut up",
 * "go away", "hide", etc.
 *
 * Like COMMAND_VERBS, these are things nobody says to a person in the room.
 * They're stripped from the front of an utterance and the remainder is
 * ignored — the point is the dismiss, not the rest of the sentence.
 */
const DISMISS_PHRASES = [
  'close', 'shut up', 'shut it', 'go away', 'go to sleep', 'hide',
  'disappear', 'leave me alone', 'stop listening', 'stop', 'be quiet',
  'quiet', 'silence', 'hush', 'go hide', 'go dormant', 'go background',
  'get out', 'go on', 'go off', 'that is all', 'that will be all',
  'dismiss', 'leave it', 'leave me be', 'let me work', 'let me play',
  'let me be', 'stop talking', 'enough', 'okay that is enough',
  'alright that is enough', 'go', 'vanish',
]

/**
 * Phrases that bring Senti back while it's dismissed — "hey bro",
 * "come back", "senti", etc. Same logic as wake-up: the name or a
 * friendly address is enough.
 */
const RESTORE_PHRASES = [
  'hey bro', 'hey buddy', 'hey senti', 'come back', 'wake up',
  'you back', 'are you there', 'senti', 'buddy', 'bro', 'mate',
  'hey', 'hi', 'hello', 'yo', 'you there', 'listen up',
]

export interface DismissMatch {
  dismissed: boolean
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
export function parseDismiss(textRaw: string): DismissMatch {
  const norm = textRaw.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
  const words = norm.split(' ').filter(Boolean)
  if (!words.length) return { dismissed: false }

  // Check the whole phrase first (e.g. "shut up", "go away", "let me play").
  const whole = words.join(' ')
  if (DISMISS_PHRASES.includes(whole)) return { dismissed: true }

  // Single-word dismisses ("close", "hide", "stop") only count when the
  // utterance is JUST that word — not when it starts a longer sentence.
  // "Close" = dismiss. "Close the door" = not a dismiss.
  if (words.length === 1 && DISMISS_PHRASES.includes(words[0])) return { dismissed: true }

  return { dismissed: false }
}

export function parseWake(textRaw: string): WakeMatch {
  let words = textRaw.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { woke: false, command: '' }

  let norm = words.map(normalize)

  /**
   * The name at the END counts too: "open Chrome, Senti" is how people
   * actually talk. Only trailing, and only on a short phrase — "tell Senti I
   * said hi" is ABOUT Senti, not to it, and must stay ignored.
   */
  let namedAtEnd = false
  if (norm.length > 1 && norm.length <= 8 && NAME_PATTERNS.includes(norm[norm.length - 1])) {
    namedAtEnd = true
    words = words.slice(0, -1)
    norm = norm.slice(0, -1)
  }

  /**
   * Phrases only ever said TO something. Checked before anything else,
   * because politeness stripping would otherwise reduce "can you hear me" to
   * "hear me" and lose the point of it entirely.
   */
  const whole = norm.join(' ')
  if (DIRECT_ADDRESS.includes(whole)) return { woke: true, command: textRaw.trim() }

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

  /** Length of a polite wrapper at `at` ("can you", "i want you to"), or 0. */
  const politeAt = (at: number): number => {
    for (const len of [4, 3, 2, 1]) {
      const phrase = norm.slice(at, at + len).join(' ')
      if (phrase && POLITE_LEADS.includes(phrase)) return len
    }
    return 0
  }

  // Eat the run-up and every way you addressed it: "hey senti buddy, ...".
  //
  // Politeness is deliberately NOT eaten here. It's only looked past further
  // down, to spot a verb hiding behind "can you". Consuming it would mangle
  // ordinary speech — "hey Senti, can you hear me" would arrive as "hear me",
  // which is a different question.
  let i = 0
  let woke = false
  let greeted = false
  while (i < norm.length) {
    const a = addressAt(i)
    if (a) {
      i += a
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

  // Named or greeted Senti outright — at the front, or trailing on the end.
  if (woke || namedAtEnd) return { woke: true, command }

  // "Hello." on its own is aimed at Senti — nothing else is left for it to be.
  if (greeted && i >= norm.length) return { woke: true, command: '' }

  // A bare imperative — "open Chrome", "can you clean my system" — is a command
  // no matter how it's dressed, because you don't say that to a person nearby.
  // Politeness is stepped OVER to find the verb, but stays in the command:
  // the assistant reads "can you open Chrome" perfectly well, and trimming it
  // only risks mangling a sentence that wasn't an order at all.
  const afterPolite = i + politeAt(i)
  if (COMMAND_VERBS.includes(norm[i]) || COMMAND_VERBS.includes(norm[afterPolite])) {
    return { woke: true, command }
  }

  return { woke: false, command: '' }
}
