import { api } from './api'

/**
 * Your other machines, from inside the software.
 *
 * The same "My Devices" power the web dashboard has, but native: this install
 * lists every device on your account, sees what each is doing live, queues
 * commands on them (lock, sleep, shut down, clean, share screen…), and watches
 * a sibling's screen. Install Senti on the laptop, link the same account, and
 * the laptop controls the PC — no browser needed.
 *
 * All of it rides the existing pull model: commands are queued in the cloud
 * and the target picks them up within ~6s, runs them through its OWN
 * permission dial, and reports back. Nothing here can touch a machine that
 * isn't linked to this same account.
 */
const PEERS_PATH = '/api/device/peers'
const PEER_SCREEN_PATH = '/api/device/peers/screen'

export interface PeerDevice {
  id: string
  name: string
  os: string
  self: boolean
  status: string
  activity: string | null
  vitals: string | null
  reportedAt: string | null
  lastSeen: string | null
}

export async function listPeers(): Promise<PeerDevice[]> {
  const res = await api<{ devices?: PeerDevice[] }>(PEERS_PATH)
  return res.ok && Array.isArray(res.data?.devices) ? res.data.devices : []
}

/** Queue an action on a sibling device. Returns a line to show the user. */
export async function commandPeer(
  deviceId: string,
  action: string,
  args?: Record<string, string | boolean>
): Promise<boolean> {
  const res = await api(PEERS_PATH, { method: 'POST', body: { deviceId, action, ...args } })
  return res.ok
}

/** The sibling's latest screen frame, or null when it isn't sharing. */
export async function peerScreen(deviceId: string): Promise<{ frame: string | null; sharing: boolean }> {
  const res = await api<{ frame?: string | null; sharing?: boolean }>(
    `${PEER_SCREEN_PATH}?deviceId=${encodeURIComponent(deviceId)}`
  )
  if (!res.ok) return { frame: null, sharing: false }
  return { frame: res.data?.frame ?? null, sharing: !!res.data?.sharing }
}
