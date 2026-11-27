/**
 * micChoice — which microphone Sentinel listens on, decided explicitly.
 *
 * Sentinel used to follow whatever Windows called the default input without
 * ever asking. That is wrong surprisingly often (a webcam mic across the room,
 * a disconnected headset, a "Stereo Mix" loopback), and the only symptom is
 * that Sentinel "can't hear you". So the user is asked once, and the answer is
 * honoured — including telling them, rather than silently guessing, when the
 * microphone they picked isn't plugged in.
 *
 * Pure logic, no DOM: everything here runs (and is tested) without a browser.
 */

/** A real, selectable input device. */
export interface MicInput {
  id: string
  label: string
}

/** What's plugged in right now, as the picker should show it. */
export interface MicInventory {
  /** Real microphones only — Chromium's "default"/"communications" aliases removed. */
  inputs: MicInput[]
  /** Which physical device Windows currently treats as default, if known. */
  windowsDefault: string | null
}

/** The persisted choice. `id === ''` means "follow the Windows default" on purpose. */
export interface StoredMic {
  id: string
  label: string
}

/** How to open the microphone, given the stored choice and what's connected. */
export type MicResolution =
  /** Follow the Windows default (chosen deliberately, or nothing chosen). */
  | { kind: 'default' }
  /** The chosen device is connected under its saved id. */
  | { kind: 'chosen'; id: string }
  /**
   * The chosen device is connected, but Chromium gave it a new id (they are
   * regenerated when site data is cleared). Matched by its unique label; the
   * caller should save the new id.
   */
  | { kind: 'relabeled'; id: string; label: string }
  /** The chosen device isn't connected. Fall back to default — and SAY so. */
  | { kind: 'missing'; label: string }

/** Chromium's alias entries — not real devices, so never listed as choices. */
const ALIAS_IDS = new Set(['default', 'communications'])

/** Minimal shape of `MediaDeviceInfo`, so this is testable without a browser. */
export interface DeviceLike {
  deviceId: string
  kind: string
  label: string
}

/** "Default - Microphone (Realtek Audio)" → "Microphone (Realtek Audio)". */
export function stripAliasPrefix(label: string): string {
  return label.replace(/^(default|communications)\s*-\s*/i, '').trim()
}

export function buildInventory(devices: readonly DeviceLike[]): MicInventory {
  const inputs: MicInput[] = []
  const seen = new Set<string>()
  let windowsDefault: string | null = null

  for (const d of devices) {
    if (d.kind !== 'audioinput') continue
    if (d.deviceId === 'default') {
      windowsDefault = stripAliasPrefix(d.label) || null
      continue
    }
    if (ALIAS_IDS.has(d.deviceId) || !d.deviceId || seen.has(d.deviceId)) continue
    seen.add(d.deviceId)
    inputs.push({ id: d.deviceId, label: d.label.trim() || `Microphone ${inputs.length + 1}` })
  }
  return { inputs, windowsDefault }
}

/**
 * Decide which device to open. Never throws, never returns a device that
 * isn't plugged in — a missing choice is reported, not papered over.
 */
export function resolveMic(stored: StoredMic, inventory: MicInventory): MicResolution {
  const id = stored.id
  // '' is an explicit "Windows default"; 'default' is the same thing, saved by
  // older builds whose dropdown listed Chromium's alias entry.
  if (!id || id === 'default') return { kind: 'default' }
  // The communications alias is a Windows routing choice, not a device: it
  // always exists while any mic does, so honour it as-is.
  if (id === 'communications') return { kind: 'chosen', id }

  if (inventory.inputs.some((m) => m.id === id)) return { kind: 'chosen', id }

  // Same physical mic, new id? Only trust the label when it's unambiguous —
  // two identical USB headsets must not be silently swapped for each other.
  const label = stored.label.trim()
  if (label) {
    const sameName = inventory.inputs.filter((m) => m.label === label)
    if (sameName.length === 1) return { kind: 'relabeled', id: sameName[0].id, label }
  }
  return { kind: 'missing', label: label || 'your chosen microphone' }
}

/** What the picker shows for the "follow Windows" option. */
export function defaultOptionLabel(inventory: MicInventory): string {
  return inventory.windowsDefault ? `Windows default (${inventory.windowsDefault})` : 'Windows default'
}

/**
 * Whether an install that finished setup before Sentinel asked about
 * microphones should be asked now. Once only: after that it lives in Settings.
 */
export function shouldPromptForMic(s: {
  signedIn: boolean
  alwaysListening: boolean
  confirmed: boolean
  prompted: boolean
}): boolean {
  return s.signedIn && s.alwaysListening && !s.confirmed && !s.prompted
}

/** Status line while listening, honest about which mic is actually in use. */
export function listeningStatus(missingLabel: string | null): string {
  return missingLabel
    ? `Listening on the Windows default — “${missingLabel}” isn’t connected.`
    : 'Listening.'
}

/**
 * Same 0–1 scale as the Control Center meter, so "the bar moved" means the
 * same thing in setup as it does later.
 */
export function meterLevel(rms: number): number {
  return Math.max(0, Math.min(1, rms * 6))
}

/** Loud enough on the meter to count as "it heard you" during the mic test. */
export const HEARD_LEVEL = 0.15
