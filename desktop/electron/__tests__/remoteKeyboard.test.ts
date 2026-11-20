import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputOrder, RemoteKeyboard } from '../remoteKeyboard'
import { drainInjector } from '../drainInjector'

// No Electron, PowerShell or real OS input in these tests.
describe('remote key writer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  it('pairs physical edges, suppresses repeated downs, and cancels Node repeat timers on reset', () => {
    const lines: string[] = [], keys = new RemoteKeyboard(line => lines.push(line))
    keys.handle({ t: 'keydown', code: 'ShiftLeft', k: 'Shift', seq: 1 })
    keys.handle({ t: 'keydown', code: 'KeyW', k: 'W', seq: 2 })
    keys.handle({ t: 'keydown', code: 'KeyW', k: 'W', seq: 3 })
    vi.advanceTimersByTime(432)
    keys.handle({ t: 'keyup', code: 'ShiftLeft', k: 'Shift', seq: 4 })
    keys.reset()
    vi.advanceTimersByTime(10_000)
    expect(lines).toEqual(['D 0x10', 'D 0x57', 'D 0x57', 'D 0x57', 'U 0x10', 'U 0x57'])
    expect(vi.getTimerCount()).toBe(0)
  })
  it('tracks overlapping legacy chord modifiers, ignoring stray keyups and unsupported taps', () => {
    const lines: string[] = [], keys = new RemoteKeyboard(line => lines.push(line))
    keys.handle({ t: 'keydown', k: 'A', mods: ['ctrl'] })
    keys.handle({ t: 'keydown', k: 'b', mods: ['ctrl'] })
    keys.handle({ t: 'keyup', k: 'a' })
    keys.handle({ t: 'keyup', k: 'b' })
    keys.handle({ t: 'keyup', k: 'b' })
    expect(keys.handle({ t: 'key', k: 'Enter', mods: ['alt'] })).toBe(false)
    expect(lines).toEqual(['D 0x11', 'D 0x41', 'D 0x42', 'U 0x41', 'U 0x42', 'U 0x11'])
    expect(vi.getTimerCount()).toBe(0)
  })
  it('releases on missing keyups without inventing presses from snapshots; expires a lost final release', () => {
    const lines: string[] = [], keys = new RemoteKeyboard(line => lines.push(line))
    keys.handle({ t: 'keydown', code: 'ControlLeft', seq: 1 })
    keys.handle({ t: 'keydown', code: 'MetaLeft', seq: 2 })
    vi.advanceTimersByTime(2500)
    keys.handle({ t: 'keysync', keys: ['KeyX', 'ControlLeft'], seq: 4 })
    vi.advanceTimersByTime(2999)
    expect(lines).toEqual(['D 0x11', 'D 0x5b', 'U 0x5b'])
    vi.advanceTimersByTime(1)
    expect(lines.at(-1)).toBe('U 0x11')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not turn a missing Ctrl down into a bare click or keystroke', () => {
    const write = vi.fn(), keys = new RemoteKeyboard(write)
    keys.handle({ t: 'keysync', keys: ['ControlLeft'], seq: 3 })
    expect(keys.handle({ t: 'click', seq: 4 })).toBe(true) // consumed, not passed to mouse writer
    keys.handle({ t: 'keydown', code: 'KeyC', seq: 5 })
    expect(write).not.toHaveBeenCalled()
    keys.handle({ t: 'keyup', code: 'ControlLeft', seq: 6 })
    keys.handle({ t: 'keyup', code: 'KeyC', seq: 7 })
    expect(keys.handle({ t: 'click', seq: 8 })).toBe(false)
  })
  it('rejects late clicks, repeats and keyups behind a new path barrier', () => {
    const order = new InputOrder()
    expect(order.accept({ t: 'keyreset', seq: 12 })).toBe(true)
    expect(order.accept({ t: 'click', seq: 4 })).toBe(false)
    expect(order.accept({ t: 'keyup', seq: 11 })).toBe(false)
    expect(order.accept({ t: 'keyreset', seq: 12 })).toBe(false)
    expect(order.accept({ t: 'type', seq: 13 })).toBe(true)
  })
  it('releases before stdin EOF and waits for child close rather than killing unread releases', async () => {
    const lines: string[] = [], keys = new RemoteKeyboard(line => lines.push(line))
    const child = Object.assign(new EventEmitter(), { stdin: { end: () => lines.push('EOF') }, kill: vi.fn() })
    keys.handle({ t: 'keydown', k: 'x', mods: ['ctrl'] })
    let stopped = false
    const drain = drainInjector(child as unknown as ChildProcess, () => keys.reset()).then(() => { stopped = true })
    vi.advanceTimersByTime(3000)
    expect(lines).toEqual(['D 0x11', 'D 0x58', 'U 0x58', 'U 0x11', 'EOF'])
    expect(stopped).toBe(false)
    child.emit('close')
    await drain
    expect(child.kill).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('bounds the wait for a wedged child', async () => {
    const child = Object.assign(new EventEmitter(), { stdin: { end: vi.fn() }, kill: vi.fn() })
    const drain = drainInjector(child as unknown as ChildProcess, () => {})
    vi.runAllTimers()
    await drain
    expect(child.kill).toHaveBeenCalledTimes(1)
  })
})
