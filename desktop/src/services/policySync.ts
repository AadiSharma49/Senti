import { useVoiceProfileStore, type SecurityMode } from '../state/voiceProfileStore'
import { useSettingsStore } from '../state/settingsStore'
import { useDeviceStore } from '../state/deviceStore'

/**
 * policySync - the desktop is a secure endpoint that OBEYS the dashboard.
 * If this device is linked to an account (has a pairing token), it pulls
 * that account's policy and reports its own status. Otherwise it falls
 * back to the shared local policy.
 *
 * Local dev uses localhost:3000. Later this becomes the account API over
 * HTTPS.
 */
const BASE = 'http://localhost:3000'
const DEVICE_POLICY_URL = `${BASE}/api/device/policy`

interface RemotePolicy {
  securityMode?: SecurityMode
  voiceThreshold?: number
  maxAttempts?: number
  lockoutDuration?: number
}

function applyPolicy(p: RemotePolicy): void {
  const voice = useVoiceProfileStore.getState()
  if (p.securityMode === 'voice_only' || p.securityMode === 'phrase_and_voice') {
    voice.setSecurityMode(p.securityMode)
  }
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
  const token = useDeviceStore.getState().token
  if (!token) return false // unlinked: use local config, don't call the dashboard

  try {
    const info = await deviceInfo()
    const voiceEnrolled = !!useVoiceProfileStore.getState().profile
    const res = await fetch(DEVICE_POLICY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: info.hostname, os: prettyOs(info.platform), voiceEnrolled, status: 'locked' }),
    })
    if (!res.ok) return false
    const data = await res.json()
    applyPolicy(data.policy ?? {})
    return true
  } catch {
    // Dashboard not reachable — keep the last known local policy.
    return false
  }
}
