import { api } from './api'

/**
 * policySync - the desktop is a secure endpoint that OBEYS the dashboard.
 * If this device is linked to an account (has a pairing token), it reports
 * its own status on check-in. Otherwise it's standalone.
 *
 * The backend URL comes from config.ts (build-time env, or a URL saved in
 * Settings) — never hardcoded here.
 */
const DEVICE_POLICY_PATH = '/api/device/policy'

const prettyOs = (platform: string): string =>
  platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform

async function deviceInfo(): Promise<{ hostname: string; platform: string }> {
  try {
    const info = await window.senti?.deviceInfo?.()
    if (info) return info
  } catch {
    // ignore
  }
  return { hostname: 'This device', platform: 'win32' }
}

async function hardwareId(): Promise<string | undefined> {
  try {
    return (await window.senti?.hardwareId?.()) || undefined
  } catch {
    return undefined
  }
}

export interface SyncResult {
  ok: boolean
  /** Set when the server rejected the check-in for a specific reason (e.g. this
   *  machine is already linked to a different account) — surfaced to the user
   *  instead of a generic "token rejected" message. */
  error?: string
}

/**
 * Check in with the dashboard. Only runs when the device is linked (has a
 * pairing token); an unlinked device is standalone. Returns ok:true if the
 * check-in succeeded.
 */
export async function syncPolicyFromDashboard(): Promise<SyncResult> {
  const info = await deviceInfo()
  const hwId = await hardwareId()

  const res = await api<{ error?: string }>(DEVICE_POLICY_PATH, {
    method: 'POST',
    body: { name: info.hostname, os: prettyOs(info.platform), hardwareId: hwId },
  })
  // Unlinked, offline, or rejected — nothing to do.
  return { ok: res.ok, error: res.ok ? undefined : res.data?.error }
}
