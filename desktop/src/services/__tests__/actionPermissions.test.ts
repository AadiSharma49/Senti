import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ACTION_PERMISSIONS, DENIED_PHRASE, isActionAllowed, type PermissionKey } from '../actionPermissions'

/**
 * Derived from the table, never hand-written. A fixture listing permissions by
 * hand goes stale the moment one is added — which it did: adding `seeScreen`
 * turned "allows every gated action" red for a permission the fixture had
 * simply never heard of, not for any real fault.
 */
const KEYS = [...new Set(Object.values(ACTION_PERMISSIONS).filter((k): k is PermissionKey => k !== null))]
const ALL_OFF: Record<string, boolean> = Object.fromEntries(KEYS.map((k) => [k, false]))
const ALL_ON: Record<string, boolean> = Object.fromEntries(KEYS.map((k) => [k, true]))

describe('action permissions', () => {
  it('refuses an unknown action', () => {
    // Failing shut is the only safe default for something that acts on a real
    // machine — a typo'd or injected action name must never run.
    expect(isActionAllowed('rm_rf_everything', ALL_ON)).toBe(false)
    expect(isActionAllowed('', ALL_ON)).toBe(false)
  })

  it('blocks every gated action when its switch is off', () => {
    for (const [action, key] of Object.entries(ACTION_PERMISSIONS)) {
      if (key === null) continue
      expect(isActionAllowed(action, ALL_OFF), `${action} ran with everything off`).toBe(false)
    }
  })

  it('allows every gated action when its switch is on', () => {
    for (const [action, key] of Object.entries(ACTION_PERMISSIONS)) {
      if (key === null) continue
      expect(isActionAllowed(action, ALL_ON), `${action} blocked with everything on`).toBe(true)
    }
  })

  it('only lets an action through on ITS OWN permission', () => {
    // Guards against a copy-paste error wiring two actions to one switch.
    for (const [action, key] of Object.entries(ACTION_PERMISSIONS)) {
      if (key === null) continue
      const onlyThis = { ...ALL_OFF, [key]: true }
      expect(isActionAllowed(action, onlyThis)).toBe(true)

      const allButThis = { ...ALL_ON, [key]: false }
      expect(isActionAllowed(action, allButThis), `${action} slipped past ${key}`).toBe(false)
    }
  })

  it('keeps the destructive actions behind cleanup and systemControl', () => {
    // Named explicitly so a future refactor can't quietly re-point them at a
    // permission the user is likelier to leave on.
    const expected: Record<string, PermissionKey> = {
      clean_temp: 'cleanup',
      empty_recycle_bin: 'cleanup',
      power: 'systemControl',
      lock_workstation: 'systemControl',
      close_app: 'closeApps',
    }
    for (const [action, key] of Object.entries(expected)) {
      expect(ACTION_PERMISSIONS[action]).toBe(key)
    }
  })

  /**
   * These two guard the gap this table once had: it was fully tested while
   * runAction checked its own inline `perms.x` conditions, so the tests were
   * green against a table the running code never consulted. A new action
   * could ship gated by nothing and nothing would fail.
   */
  it('is the gate runAction actually uses', () => {
    const src = readFileSync(join(__dirname, '..', 'actions.ts'), 'utf8')
    expect(src).toContain('isActionAllowed(')
    // No case may re-check permissions inline; that's how they drift apart.
    expect(src).not.toMatch(/if \(!perms\.\w+\)/)
  })

  it('covers every action runAction can handle', () => {
    const src = readFileSync(join(__dirname, '..', 'actions.ts'), 'utf8')
    const handled = [...src.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1])
    for (const action of handled) {
      expect(ACTION_PERMISSIONS, `${action} is handled but has no permission entry`).toHaveProperty(action)
    }
  })

  it('has a refusal phrase for every gated action', () => {
    for (const [action, key] of Object.entries(ACTION_PERMISSIONS)) {
      if (key === null) continue
      // Without one, a refusal reads "I'm not allowed to do that" and the
      // user has no idea which switch to go and find.
      expect(DENIED_PHRASE[action], `${action} has no refusal phrase`).toBeTruthy()
    }
  })

  it('only exempts actions that touch nothing on the machine', () => {
    const exempt = Object.entries(ACTION_PERMISSIONS)
      .filter(([, k]) => k === null)
      .map(([a]) => a)
      .sort()
    // remember only writes Senti's own memory file.
    // plan is handled by the LLM itself — no system action.
    expect(exempt).toEqual(['plan', 'remember'])
  })
})
