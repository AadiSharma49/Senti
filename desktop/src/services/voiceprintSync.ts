import { useVoiceProfileStore } from '../state/voiceProfileStore'
import { api } from './api'

/**
 * voiceprintSync — keeps the on-device voiceprint in step with the account.
 *
 * Enrollment happens on the device; the voiceprint (256 numbers, never audio)
 * is uploaded so it flows to the user's other devices, and a newly-linked
 * device with no local profile downloads it. It is encrypted at rest on the
 * server — biometric data is the one credential a user can never rotate.
 *
 * Requests go through the main process, so the device token is never exposed
 * to renderer code.
 */
const VOICEPRINT_PATH = '/api/device/voiceprint'

interface RemoteProfile {
  embedding?: unknown
  sampleCount?: unknown
  modelId?: unknown
  createdAt?: unknown
}

/** Upload this device's voiceprint to the account. */
export async function uploadVoiceprint(): Promise<boolean> {
  const profile = useVoiceProfileStore.getState().profile
  if (!profile) return false

  const res = await api(VOICEPRINT_PATH, {
    method: 'POST',
    body: {
      embedding: profile.embedding,
      sampleCount: profile.sampleCount,
      modelId: profile.modelId,
    },
  })
  return res.ok
}

/**
 * If this device has no local voiceprint but the account has one, download and
 * store it — so a freshly-linked device can unlock without re-enrolling.
 */
export async function ensureVoiceprint(): Promise<boolean> {
  if (useVoiceProfileStore.getState().profile) return false // already have one locally

  const res = await api<{ profile?: RemoteProfile | null }>(VOICEPRINT_PATH)
  if (!res.ok) return false

  const p = res.data?.profile
  if (!p || !Array.isArray(p.embedding) || p.embedding.length === 0) return false

  useVoiceProfileStore.getState().setProfile({
    embedding: p.embedding as number[],
    sampleCount: typeof p.sampleCount === 'number' ? p.sampleCount : 0,
    modelId: typeof p.modelId === 'string' ? p.modelId : 'unknown',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
  })
  return true
}
