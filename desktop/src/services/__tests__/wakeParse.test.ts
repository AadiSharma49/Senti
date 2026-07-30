import { describe, it, expect } from 'vitest'
import { parseWake } from '../wakeParse'

/**
 * The wake parser fails SILENTLY when it breaks — Senti simply doesn't answer,
 * and there's no error anywhere to notice. That's exactly the shape of bug
 * that costs days, so it's pinned here in both directions: what must wake it,
 * and what must never.
 */
describe('parseWake — addressed to Senti', () => {
  const wakes: [string, string][] = [
    ['hey senti', ''],
    ['senti', ''],
    ['hello', ''],
    ['wake up', ''],
    ['buddy', ''],
    ['wake up buddy', ''],
    ['Hey Senti, delete temporary files', 'delete temporary files'],
    ['hey senti can you hear me', 'can you hear me'],
    ['buddy clean my system', 'clean my system'],
    ['wake up buddy, open VS Code', 'open VS Code'],
    ['hello clean my system', 'clean my system'],
    ['hey senti buddy lock my pc', 'lock my pc'],
    ['yo century turn it up', 'turn it up'],
  ]

  it.each(wakes)('wakes on %j', (input, command) => {
    const r = parseWake(input)
    expect(r.woke).toBe(true)
    expect(r.command).toBe(command)
  })

  it('keeps apostrophes and case in the command', () => {
    // The command is sliced from the ORIGINAL text, so "what's" must survive
    // the lowercase/strip pass used for matching.
    const r = parseWake("Okay Senti, what's my RAM usage?")
    expect(r.command).toBe("what's my RAM usage?")
  })
})

describe('parseWake — bare commands need no wake word', () => {
  /**
   * The command keeps its politeness. "Can you open Chrome" is stepped over
   * only far enough to SEE the verb; the assistant reads the whole phrase
   * fine, and trimming it risks mangling sentences that were never orders.
   */
  const commands: [string, string][] = [
    ['open chrome', 'open chrome'],
    ['Can you open Chrome?', 'Can you open Chrome?'],
    ['could you clean my system', 'could you clean my system'],
    ['i want you to open chrome', 'i want you to open chrome'],
    ['mute', 'mute'],
    ['close spotify', 'close spotify'],
    ['pull up youtube', 'pull up youtube'],
  ]

  it.each(commands)('runs %j directly', (input, command) => {
    const r = parseWake(input)
    expect(r.woke).toBe(true)
    expect(r.command).toBe(command)
  })

  it('does not eat politeness out of a real question', () => {
    // The regression that motivated this: "can you hear me" is a question,
    // not a command wrapped in politeness.
    expect(parseWake('hey senti can you hear me').command).toBe('can you hear me')
  })
})

describe('parseWake — must stay quiet', () => {
  /**
   * Every one of these would make Senti answer a conversation it wasn't part
   * of. The homophones matter most: "sanity" and "century" are real words that
   * Whisper produces when it mishears the name.
   */
  const silent = [
    'how are you doing',
    'what time is it',
    'send it to me later',
    'I lost my sanity yesterday',
    'the century was long',
    'set me up with a meeting',
    'can you send it over',
    'hello how are you',
    'so um I was thinking',
    'okay',
    'tell Senti I said hi',
    'i think we should open a new office',
    '',
    '   ',
  ]

  it.each(silent)('ignores %j', (input) => {
    expect(parseWake(input).woke).toBe(false)
  })
})
