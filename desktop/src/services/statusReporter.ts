import { api } from './api'
import { getSystemSnapshot } from './systemInfo'

/**
 * statusReporter — pushes a small "what is Senti doing / how is the machine"
 * snapshot up to the dashboard, so you can check on this PC from your phone.
 *
 * Fires on a heartbeat (every 30s) and immediately whenever the activity
 * changes, so remote updates feel live. While Senti is actively working it
 * also holds the machine awake, so a long task can't put it to sleep and cut
 * you off mid-progress.
 *
 * Nothing sensitive leaves: just a one-line activity string and a vitals
 * summary (RAM/disk) — the same you'd glance at in Task Manager.
 */
const HEARTBEAT_MS = 30_000

let timer: number | null = null
let currentActivity = 'Idle'
let working = false

async function push(): Promise<void> {
  try {
    const snap = await getSystemSnapshot()
    const vitals = snap
      ? `${snap.ramUsedPct}% RAM${snap.disks?.[0] ? ` · ${snap.disks[0].drive} ${snap.disks[0].freeGB}GB free` : ''}`
      : undefined
    await api('/api/device/status', {
      method: 'POST',
      body: { activity: currentActivity, vitals, status: working ? 'working' : 'idle' },
    })
  } catch {
    // Offline or unlinked — nothing to report to.
  }
}

/** Update what Senti is doing. Pushes right away so the phone sees it live. */
export function reportActivity(activity: string, isWorking = false): void {
  currentActivity = activity
  if (isWorking !== working) {
    working = isWorking
    // Keep the machine awake while there's active work to watch remotely.
    try {
      void window.senti?.keepAwake?.(isWorking)
    } catch {}
  }
  void push()
}

/** Begin the heartbeat once the device is linked and unlocked. */
export function startReporting(): void {
  if (timer !== null) return
  void push()
  timer = window.setInterval(() => void push(), HEARTBEAT_MS)
}

export function stopReporting(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  working = false
  try {
    void window.senti?.keepAwake?.(false)
  } catch {}
}
