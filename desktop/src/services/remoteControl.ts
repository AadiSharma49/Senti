import { api } from './api'
import { peerScreen } from './peers'
import { startViewerPeer, type PeerHandle } from './webrtc'

/**
 * Driving another machine — the sending half of remote control.
 *
 * Start a session against one of your other devices, verify its PIN, then
 * stream input to it while pulling its screen back.
 *
 * Mouse moves are throttled and coalesced on purpose: a mouse produces dozens
 * of events a second, and forwarding each as its own request would flood the
 * backend to no benefit — only the LATEST position matters. Clicks and
 * keystrokes are never dropped, because every one of those is intentional.
 */
const SESSION_PATH = '/api/device/remote/session'
const INPUT_PATH = '/api/device/remote/input'
const FLUSH_MS = 80
const HEARTBEAT_MS = 6000

export interface RemoteEvent {
  /** `moverel` carries a delta rather than a position — see the game mode. */
  t: 'move' | 'moverel' | 'click' | 'scroll' | 'type' | 'key'
  x?: number
  y?: number
  b?: 'left' | 'right' | 'middle'
  d?: number
  text?: string
  k?: string
  mods?: string[]
}

let sessionId: string | null = null
let queue: RemoteEvent[] = []
/** The newest pointer position, kept apart so it can be coalesced. */
let pendingMove: RemoteEvent | null = null
let flushTimer: number | null = null
let beatTimer: number | null = null
/** Direct connection to the target, when one comes up. */
let peer: PeerHandle | null = null
let peerLive = false

export function currentSession(): string | null {
  return sessionId
}

export type StartResult =
  | { ok: true; id: string; method: 'email' | 'pin'; sentTo?: string }
  | { ok: false; reason: 'no-pin' | 'failed'; message: string }

/**
 * Ask to control a device. The session is inert until it's verified — with a
 * code emailed to the account owner when email is configured, otherwise the
 * static PIN set on the target machine.
 */
export async function startSession(targetDeviceId: string): Promise<StartResult> {
  const res = await api<{ id?: string; error?: string; message?: string; method?: string; sentTo?: string }>(
    SESSION_PATH,
    { method: 'POST', body: { action: 'start', targetDeviceId } }
  )
  if (res.ok && res.data?.id) {
    sessionId = res.data.id
    return {
      ok: true,
      id: res.data.id,
      method: res.data.method === 'email' ? 'email' : 'pin',
      sentTo: res.data.sentTo,
    }
  }
  if (res.data?.error === 'no-pin') {
    return {
      ok: false,
      reason: 'no-pin',
      message: res.data.message || 'Remote control is not set up on that machine yet.',
    }
  }
  return { ok: false, reason: 'failed', message: "Couldn't start a session with that device." }
}

export type VerifyResult = { ok: true } | { ok: false; attemptsLeft: number; message: string }

/** Hand over the PIN. Only on success does the session start accepting input. */
export async function verifyPin(pin: string): Promise<VerifyResult> {
  if (!sessionId) return { ok: false, attemptsLeft: 0, message: 'No session.' }
  const res = await api<{ ok?: boolean; attemptsLeft?: number }>(SESSION_PATH, {
    method: 'POST',
    body: { action: 'verify', id: sessionId, pin },
  })
  if (res.ok && res.data?.ok) {
    startPumps()
    return { ok: true }
  }
  const left = res.data?.attemptsLeft ?? 0
  if (left <= 0) {
    // Out of attempts: the backend killed the session, so drop it here too
    // rather than leaving a dead id that quietly rejects everything.
    sessionId = null
    return { ok: false, attemptsLeft: 0, message: 'Too many wrong PINs — session cancelled.' }
  }
  return { ok: false, attemptsLeft: left, message: `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` }
}

export async function endSession(): Promise<void> {
  const id = sessionId
  sessionId = null
  queue = []
  pendingMove = null
  stopPumps()
  try {
    peer?.close()
  } catch {
    // already closed
  }
  peer = null
  peerLive = false
  if (id) {
    try {
      await api(SESSION_PATH, { method: 'POST', body: { action: 'end', id } })
    } catch {
      // The target hangs up on its own once heartbeats stop.
    }
  }
}

/** Queue an event. Absolute moves coalesce; everything else is kept. */
export function sendEvent(e: RemoteEvent): void {
  if (!sessionId) return
  if (e.t === 'move') {
    // Only the newest position matters — older ones are already wrong.
    pendingMove = e
    return
  }
  if (e.t === 'moverel') {
    // Deltas must ACCUMULATE, never replace. Dropping one loses that much
    // movement permanently, which in a game reads as the camera sticking.
    const last = queue[queue.length - 1]
    if (last?.t === 'moverel') {
      last.x = (last.x ?? 0) + (e.x ?? 0)
      last.y = (last.y ?? 0) + (e.y ?? 0)
    } else {
      queue.push({ ...e })
    }
    return
  }
  queue.push(e)
}

async function flush(): Promise<void> {
  if (!sessionId) return
  // A move must be applied BEFORE the click that follows it, or the click
  // lands wherever the pointer happened to be.
  const batch = pendingMove ? [pendingMove, ...queue] : queue
  pendingMove = null
  queue = []
  if (!batch.length) return

  // Straight down the data channel when it's up — no HTTP round trip, which
  // is what makes clicking feel immediate instead of ~150ms behind.
  if (peerLive && peer?.send(batch)) return

  try {
    await api(INPUT_PATH, { method: 'POST', body: { id: sessionId, events: batch } })
  } catch {
    // Dropped input is better than a growing backlog of stale clicks.
  }
}

/**
 * Try for a direct connection to the target. Resolves true once video is
 * actually flowing; on failure the caller keeps using the frame path, so a
 * network that won't allow peer-to-peer degrades instead of going black.
 */
export async function connectPeer(onStream: (s: MediaStream) => void): Promise<boolean> {
  if (!sessionId) return false
  try {
    peer = await startViewerPeer(
      sessionId,
      onStream,
      (ok) => {
        peerLive = ok
      }
    )
  } catch {
    peer = null
    peerLive = false
    return false
  }

  // Give ICE a fair chance before declaring it a lost cause.
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (peerLive) return true
    if (!sessionId) return false
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

export function isPeerLive(): boolean {
  return peerLive
}

function startPumps(): void {
  stopPumps()
  flushTimer = window.setInterval(() => void flush(), FLUSH_MS)
  beatTimer = window.setInterval(() => {
    if (sessionId) void api(SESSION_PATH, { method: 'POST', body: { action: 'heartbeat', id: sessionId } })
  }, HEARTBEAT_MS)
}

function stopPumps(): void {
  if (flushTimer !== null) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  if (beatTimer !== null) {
    clearInterval(beatTimer)
    beatTimer = null
  }
}

/** The target's newest screen frame, for the control window. */
export async function targetFrame(deviceId: string): Promise<string | null> {
  const s = await peerScreen(deviceId)
  return s.frame
}
