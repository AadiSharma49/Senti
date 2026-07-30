import { describe, it, expect } from 'vitest'
import path from 'path'
import { resolveInside, isFileRootKey, FILE_ROOT_KEYS } from '../pathSafety'

const BASE = path.resolve('C:/Users/Someone/Documents')

/**
 * This function is what stands between "browse my Documents from my laptop"
 * and "read my whole drive from anywhere". A regression here is invisible in
 * the UI — everything would still appear to work — so it's pinned hard.
 */
describe('resolveInside — traversal must not escape', () => {
  const attacks = [
    '..',
    '../..',
    '../../Windows/System32/config/SAM',
    '..\\..\\..\\Windows\\win.ini',
    'sub/../../../secret.txt',
    'a/../../..',
    // Absolute paths must not override the root.
    'C:/Windows/win.ini',
    'C:\\Windows\\win.ini',
    // A UNC path would reach another machine entirely.
    '//server/share/x',
    '\\\\server\\share\\x',
    // The prefix trick: a sibling folder whose name starts with the root's.
    '../Documents2/other.txt',
  ]

  it.each(attacks)('refuses %j', (rel) => {
    expect(resolveInside(BASE, rel)).toBeNull()
  })
})

describe('resolveInside — legitimate paths still work', () => {
  const ok: [string, string][] = [
    ['', BASE],
    ['report.pdf', path.join(BASE, 'report.pdf')],
    ['work/notes.txt', path.join(BASE, 'work', 'notes.txt')],
    ['a/b/c.png', path.join(BASE, 'a', 'b', 'c.png')],
    // Climbing back down into the root is fine; only escaping is not.
    ['sub/../report.pdf', path.join(BASE, 'report.pdf')],
  ]

  it.each(ok)('allows %j', (rel, expected) => {
    expect(resolveInside(BASE, rel)).toBe(expected)
  })

  it('treats a trailing separator on the base the same way', () => {
    expect(resolveInside(BASE + path.sep, 'report.pdf')).toBe(path.join(BASE, 'report.pdf'))
    expect(resolveInside(BASE + path.sep, '../escape.txt')).toBeNull()
  })
})

describe('file root keys', () => {
  it('accepts only the six shared folders', () => {
    for (const k of FILE_ROOT_KEYS) expect(isFileRootKey(k)).toBe(true)
    for (const k of ['', 'system32', 'appdata', 'home', 'C:/']) {
      expect(isFileRootKey(k)).toBe(false)
    }
  })
})
