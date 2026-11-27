import { describe, it, expect } from 'vitest'
import {
  buildInventory,
  defaultOptionLabel,
  listeningStatus,
  meterLevel,
  resolveMic,
  shouldPromptForMic,
  stripAliasPrefix,
  type DeviceLike,
} from '../micChoice'

/**
 * Picking the wrong microphone fails SILENTLY — Sentinel just never hears you.
 * These pin down that the choice is honoured exactly, that a missing device is
 * reported instead of quietly swapped, and that the picker never offers
 * Chromium's alias entries as if they were real devices.
 */

const mic = (deviceId: string, label: string, kind = 'audioinput'): DeviceLike => ({ deviceId, label, kind })

// What Chromium on Windows actually returns: two alias entries, then devices.
const WINDOWS_DEVICES: DeviceLike[] = [
  mic('default', 'Default - Microphone (Realtek(R) Audio)'),
  mic('communications', 'Communications - Headset Microphone (Jabra Evolve 65)'),
  mic('realtek-id', 'Microphone (Realtek(R) Audio)'),
  mic('jabra-id', 'Headset Microphone (Jabra Evolve 65)'),
  mic('cam-id', 'Microphone (HD Pro Webcam C920)'),
  mic('speaker-id', 'Speakers (Realtek(R) Audio)', 'audiooutput'),
]

describe('buildInventory', () => {
  it('lists real inputs only, and names the device Windows defaults to', () => {
    const inv = buildInventory(WINDOWS_DEVICES)
    expect(inv.inputs.map((m) => m.id)).toEqual(['realtek-id', 'jabra-id', 'cam-id'])
    expect(inv.windowsDefault).toBe('Microphone (Realtek(R) Audio)')
  })

  it('drops blank ids (no permission yet) and duplicates, and names unlabeled devices', () => {
    const inv = buildInventory([
      mic('', ''),
      mic('a', ''),
      mic('a', 'dup'),
      mic('b', '  '),
    ])
    expect(inv.inputs).toEqual([
      { id: 'a', label: 'Microphone 1' },
      { id: 'b', label: 'Microphone 2' },
    ])
    expect(inv.windowsDefault).toBeNull()
  })

  it('handles an empty or output-only device list', () => {
    expect(buildInventory([])).toEqual({ inputs: [], windowsDefault: null })
    expect(buildInventory([mic('x', 'Speakers', 'audiooutput')]).inputs).toEqual([])
  })
})

describe('stripAliasPrefix / defaultOptionLabel', () => {
  it('removes Chromium alias prefixes', () => {
    expect(stripAliasPrefix('Default - Mic (USB)')).toBe('Mic (USB)')
    expect(stripAliasPrefix('Communications - Mic (USB)')).toBe('Mic (USB)')
    expect(stripAliasPrefix('Mic (USB)')).toBe('Mic (USB)')
  })

  it('tells the user which device "Windows default" actually is', () => {
    expect(defaultOptionLabel(buildInventory(WINDOWS_DEVICES))).toBe('Windows default (Microphone (Realtek(R) Audio))')
    expect(defaultOptionLabel({ inputs: [], windowsDefault: null })).toBe('Windows default')
  })
})

describe('resolveMic', () => {
  const inv = buildInventory(WINDOWS_DEVICES)

  it('follows Windows when nothing (or the old alias) was chosen', () => {
    expect(resolveMic({ id: '', label: '' }, inv)).toEqual({ kind: 'default' })
    expect(resolveMic({ id: 'default', label: '' }, inv)).toEqual({ kind: 'default' })
  })

  it('uses the chosen device when it is connected', () => {
    expect(resolveMic({ id: 'jabra-id', label: 'Headset Microphone (Jabra Evolve 65)' }, inv)).toEqual({
      kind: 'chosen',
      id: 'jabra-id',
    })
    expect(resolveMic({ id: 'communications', label: '' }, inv)).toEqual({ kind: 'chosen', id: 'communications' })
  })

  it('re-finds the same device by name when Chromium issued it a new id', () => {
    expect(resolveMic({ id: 'old-jabra-id', label: 'Headset Microphone (Jabra Evolve 65)' }, inv)).toEqual({
      kind: 'relabeled',
      id: 'jabra-id',
      label: 'Headset Microphone (Jabra Evolve 65)',
    })
  })

  it('never guesses between two identically named devices', () => {
    const twins = buildInventory([mic('usb-1', 'USB Mic'), mic('usb-2', 'USB Mic')])
    expect(resolveMic({ id: 'usb-old', label: 'USB Mic' }, twins)).toEqual({ kind: 'missing', label: 'USB Mic' })
  })

  it('reports an unplugged choice instead of silently substituting', () => {
    expect(resolveMic({ id: 'yeti-id', label: 'Blue Yeti' }, inv)).toEqual({ kind: 'missing', label: 'Blue Yeti' })
    expect(resolveMic({ id: 'yeti-id', label: '' }, inv)).toEqual({ kind: 'missing', label: 'your chosen microphone' })
  })
})

describe('shouldPromptForMic', () => {
  const base = { signedIn: true, alwaysListening: true, confirmed: false, prompted: false }

  it('asks an upgraded install that was never asked', () => {
    expect(shouldPromptForMic(base)).toBe(true)
  })

  it('asks only once, only when listening, and never mid-setup', () => {
    expect(shouldPromptForMic({ ...base, prompted: true })).toBe(false)
    expect(shouldPromptForMic({ ...base, confirmed: true })).toBe(false)
    expect(shouldPromptForMic({ ...base, alwaysListening: false })).toBe(false)
    expect(shouldPromptForMic({ ...base, signedIn: false })).toBe(false)
  })
})

describe('listeningStatus / meterLevel', () => {
  it('stays the plain "Listening." only when on the chosen mic', () => {
    expect(listeningStatus(null)).toBe('Listening.')
    expect(listeningStatus('Blue Yeti')).toContain('Blue Yeti')
    expect(listeningStatus('Blue Yeti')).not.toBe('Listening.')
  })

  it('uses the same 0–1 meter scale as the Control Center', () => {
    expect(meterLevel(0)).toBe(0)
    expect(meterLevel(0.05)).toBeCloseTo(0.3)
    expect(meterLevel(1)).toBe(1)
    expect(meterLevel(-1)).toBe(0)
  })
})
