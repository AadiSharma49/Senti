import { useDeviceStore } from '../state/deviceStore'
import { useVoiceProfileStore } from '../state/voiceProfileStore'

/**
 * voiceprintSync - keeps the on-device voiceprint in step with the
 * account. Enrollment happens on the device; the voiceprint (256 numbers,
 * never audio) is uploaded so it flows to the user's other devices. A
 * newly-linked device with no local profile downloads it.
 *
 * Only active when the device is linked (has a pairing token).
 */
const URL = 'http://localhost:3000/api/device/voiceprint'

/** Upload this device's voiceprint to the account. */
export async function uploadVoiceprint(): Promise<boolean> {
  const token = useDeviceStore.getState().token
  const profile = useVoiceProfileStore.getState().profile
  if (!token || !profile) return false
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        embedding: profile.embedding,
        phrase: profile.phrase,
        sampleCount: profile.sampleCount,
        modelId: profile.modelId,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * If this device has no local voiceprint but the account has one, download
 * and store it — so a freshly-linked device can unlock without re-enrolling.
 */
export async function ensureVoiceprint(): Promise<boolean> {
  const token = useDeviceStore.getState().token
  if (!token) return false
  if (useVoiceProfileStore.getState().profile) return false // already have one locally
  try {
    const res = await fetch(URL, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return false
    const data = await res.json()
    const p = data.profile
    if (!p || !Array.isArray(p.embedding) || p.embedding.length === 0) return false
    useVoiceProfileStore.getState().setProfile({
      embedding: p.embedding as number[],
      phrase: typeof p.phrase === 'string' ? p.phrase : '',
      sampleCount: typeof p.sampleCount === 'number' ? p.sampleCount : 0,
      modelId: typeof p.modelId === 'string' ? p.modelId : 'unknown',
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    })
    return true
  } catch {
    return false
  }
}
