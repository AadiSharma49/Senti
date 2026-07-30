import { describe, it, expect } from 'vitest'
import { rankMemories } from '../memoryRecall'

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ text: `filler fact number ${i} about nothing`, createdAt: Date.now() }))

describe('rankMemories', () => {
  it('returns everything when there is little to rank', () => {
    const mems = [{ text: 'a' }, { text: 'b' }, { text: 'c' }]
    expect(rankMemories(mems, 'anything')).toEqual(['a', 'b', 'c'])
  })

  it('surfaces the relevant memory out of a crowd', () => {
    const mems = [
      ...many(30),
      { text: 'Their main drive is D and it is nearly full', createdAt: Date.now() },
      ...many(30),
    ]
    const picked = rankMemories(mems, 'which drive is my main one', 5)
    expect(picked).toContain('Their main drive is D and it is nearly full')
  })

  it('ranks the best match first', () => {
    const mems = [
      ...many(20),
      { text: 'Prefers dark mode in every application', createdAt: Date.now() },
      { text: 'Plays Spider-Man on weekends', createdAt: Date.now() },
    ]
    expect(rankMemories(mems, 'do I like dark mode', 3)[0]).toBe('Prefers dark mode in every application')
  })

  it('never returns more than the limit', () => {
    expect(rankMemories(many(200), 'anything at all', 12)).toHaveLength(12)
  })

  it('falls back to the most recent when nothing matches', () => {
    // A query of pure stop-words carries no signal; returning the newest is
    // more useful than an arbitrary slice.
    const mems = many(50)
    const picked = rankMemories(mems, 'the a of and is', 5)
    expect(picked).toHaveLength(5)
    expect(picked[picked.length - 1]).toBe(mems[mems.length - 1].text)
  })

  it('ignores case and punctuation', () => {
    const mems = [...many(30), { text: 'Main drive is D:', createdAt: Date.now() }]
    expect(rankMemories(mems, 'DRIVE?!', 3)).toContain('Main drive is D:')
  })
})
