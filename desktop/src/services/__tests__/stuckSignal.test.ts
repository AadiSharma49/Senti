import { describe, it, expect } from 'vitest'
import {
  noteVisit,
  noteDwell,
  looksStuck,
  VISIT_WINDOW_MS,
  type Attention,
} from '../stuckSignal'

const MIN = 60_000
const KEY = 'spiderman::Marvel Spider-Man — Mission 12'

function fresh(): Map<string, Attention> {
  return new Map()
}

describe('stuck: one long unbroken stretch', () => {
  it('is not stuck after a few minutes', () => {
    const a = fresh()
    noteVisit(a, KEY, 0)
    expect(looksStuck(a, KEY, 10 * MIN, 10 * MIN)).toBe(false)
  })

  it('is stuck after a very long stretch on the same title', () => {
    const a = fresh()
    noteVisit(a, KEY, 0)
    expect(looksStuck(a, KEY, 40 * MIN, 40 * MIN)).toBe(true)
  })
})

describe('stuck: churn — leaving and coming back', () => {
  it('spots repeated returns totalling real time', () => {
    const a = fresh()
    let now = 0
    // Four sessions on the same thing, ~6 minutes each, with gaps between.
    for (let i = 0; i < 4; i++) {
      noteVisit(a, KEY, now)
      for (let m = 0; m < 6; m++) {
        now += MIN
        noteDwell(a, KEY, MIN, now)
      }
      now += 3 * MIN // off doing something else
    }
    expect(looksStuck(a, KEY, 2 * MIN, now)).toBe(true)
  })

  it('does not fire on brief revisits that add up to nothing', () => {
    const a = fresh()
    let now = 0
    // Bouncing through a window five times but barely staying — that's
    // navigation, not being stuck on it.
    for (let i = 0; i < 5; i++) {
      noteVisit(a, KEY, now)
      now += MIN
      noteDwell(a, KEY, MIN, now)
      now += MIN
    }
    expect(looksStuck(a, KEY, MIN, now)).toBe(false)
  })

  it('does not fire on one long visit that has not yet run long', () => {
    const a = fresh()
    noteVisit(a, KEY, 0)
    for (let m = 0; m < 25; m++) noteDwell(a, KEY, MIN, m * MIN)
    // Plenty of time, but only ONE visit — concentrating, not stuck.
    expect(looksStuck(a, KEY, 25 * MIN, 25 * MIN)).toBe(false)
  })
})

describe('stuck: history expires', () => {
  it('forgets windows older than the visit window', () => {
    const a = fresh()
    noteVisit(a, KEY, 0)
    noteVisit(a, 'other::thing', VISIT_WINDOW_MS + MIN)
    // Adding the later visit prunes the stale one.
    expect(a.has(KEY)).toBe(false)
  })

  it('is not stuck on a window with no history at all', () => {
    expect(looksStuck(fresh(), KEY, 5 * MIN, 5 * MIN)).toBe(false)
  })
})
