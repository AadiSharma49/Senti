import { describe, it, expect } from 'vitest'
import { ACTION_PERMISSIONS, isActionAllowed, type PermissionKey } from '../actionPermissions'

const ALL_OFF: Record<string, boolean> = {
  openApps: false,
  closeApps: false,
  cleanup: false,
  files: false,
  screenShare: false,
  systemControl: false,
}
const ALL_ON = Object.fromEntries(Object.keys(ALL_OFF).map((k) => [k, true]))

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

  it('only exempts actions that touch nothing on the machine', () => {
    const exempt = Object.entries(ACTION_PERMISSIONS)
      .filter(([, k]) => k === null)
      .map(([a]) => a)
      .sort()
    // remember only writes Senti's own memory file.
    expect(exempt).toEqual(['remember'])
  })
})
