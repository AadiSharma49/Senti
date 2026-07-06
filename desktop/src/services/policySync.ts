import { useVoiceProfileStore, type SecurityMode } from '../state/voiceProfileStore'
import { useSettingsStore } from '../state/settingsStore'

/**
 * policySync - the desktop is a secure endpoint that OBEYS the dashboard.
 * On boot it pulls the account security policy and applies it locally, so
 * changes made on the dashboard take effect on this device.
 *
 * Local dev: the dashboard serves the policy at localhost:3000. Later this
 * becomes the authenticated account API (per-user, over HTTPS).
 */
const POLICY_URL = 'http://localhost:3000/api/policy'

interface RemotePolicy {
  securityMode?: SecurityMode
  voiceThreshold?: number
  maxAttempts?: number
  lockoutDuration?: number
}

/** Fetch and apply the dashboard policy. Returns true if applied. */
export async function syncPolicyFromDashboard(): Promise<boolean> {
  try {
    const res = await fetch(POLICY_URL, { cache: 'no-store' })
    if (!res.ok) return false
    const p = (await res.json()) as RemotePolicy

    const voice = useVoiceProfileStore.getState()
    if (p.securityMode === 'voice_only' || p.securityMode === 'phrase_and_voice') {
      voice.setSecurityMode(p.securityMode)
    }
    if (typeof p.voiceThreshold === 'number') {
      voice.setThreshold(p.voiceThreshold)
    }

    const sec: { maxAttempts?: number; lockoutDuration?: number } = {}
    if (typeof p.maxAttempts === 'number') sec.maxAttempts = p.maxAttempts
    if (typeof p.lockoutDuration === 'number') sec.lockoutDuration = p.lockoutDuration
    if (Object.keys(sec).length > 0) {
      useSettingsStore.getState().setSecurity(sec)
    }
    return true
  } catch {
    // Dashboard not reachable — keep the last known local policy.
    return false
  }
}
