import { useVoiceProfileStore } from '../state/voiceProfileStore'
import { useSettingsStore } from '../state/settingsStore'
import { api } from './api'

/**
 * policySync - the desktop is a secure endpoint that OBEYS the dashboard.
 * If this device is linked to an account (has a pairing token), it pulls
 * that account's policy and reports its own status. Otherwise it falls
 * back to the shared local policy.
 *
 * The backend URL comes from config.ts (build-time env, or a URL saved in
 * Settings) — never hardcoded here.
 */
const DEVICE_POLICY_PATH = '/api/device/policy'

// Unlock is voice-only; the dashboard no longer sends a security mode.
interface RemotePolicy {
  voiceThreshold?: number
  maxAttempts?: number
  lockoutDuration?: number
}

function applyPolicy(p: RemotePolicy): void {
  const voice = useVoiceProfileStore.getState()
  if (typeof p.voiceThreshold === 'number') voice.setThreshold(p.voiceThreshold)

  const sec: { maxAttempts?: number; lockoutDuration?: number } = {}
  if (typeof p.maxAttempts === 'number') sec.maxAttempts = p.maxAttempts
  if (typeof p.lockoutDuration === 'number') sec.lockoutDuration = p.lockoutDuration
  if (Object.keys(sec).length > 0) useSettingsStore.getState().setSecurity(sec)
}

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

/**
 * Pull and apply this account's policy. Only runs when the device is
 * linked (has a pairing token); an unlinked device is standalone and uses
 * its local config. Returns true if a policy was applied.
 */
export async function syncPolicyFromDashboard(): Promise<boolean> {
  const info = await deviceInfo()
  const voiceEnrolled = !!useVoiceProfileStore.getState().profile

  const res = await api<{ policy?: RemotePolicy }>(DEVICE_POLICY_PATH, {
    method: 'POST',
    body: { name: info.hostname, os: prettyOs(info.platform), voiceEnrolled, status: 'locked' },
  })
  // Unlinked, offline, or rejected — keep the last known local policy.
  if (!res.ok) return false

  applyPolicy(res.data?.policy ?? {})
  return true
}
