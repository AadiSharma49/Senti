import { api } from './api'
import { peerScreen } from './peers'
import { InputDelivery, type RemoteEvent } from './inputDelivery'
export type { RemoteEvent } from './inputDelivery'
import { startViewerPeer, type ViewerHandle } from './webrtc'

/**
 * Driving another machine — the sending half of remote control.
 *
 * Start a session against one of your other devices, verify its PIN, then
 * stream input to it while pulling its screen back.
 *
 * Mouse moves are throttled and coalesced on purpose: a mouse produces dozens
 * of events a second, and forwarding each as its own request would flood the
 * backend to no benefit. Clicks and keystrokes stay ordered; an uncertain
 * delivery is dropped rather than playing the same action twice.
 */
const SESSION_PATH = '/api/device/remote/session'
const INPUT_PATH = '/api/device/remote/input'
/** Default viewer → target flush cadence. */
const FLUSH_MS = 8
/** Heartbeat so abandoned viewers time out on the target. */
const HEARTBEAT_MS = 6000
let sessionId: string | null = null
let sessionRequest = 0
let delivery: InputDelivery | null = null
let flushTimer: number | null = null
let beatTimer: number | null = null
/** Direct connection to the target, when one comes up. */
let peer: ViewerHandle | null = null
let peerLive = false
interface ViewerOwner {
  id: string
  stream: MediaStream | null
  onStream: (stream: MediaStream) => void
  onConnected: (ready: boolean) => void
}
let peerOwner: ViewerOwner | null = null

export type StartResult =
  | { ok: true; id: string; method: 'email' | 'pin'; sentTo?: string }
  | { ok: false; reason: 'no-pin' | 'failed'; message: string }

/**
 * Ask to control a device. The session is inert until it's verified — with a
 * code emailed to the account owner when email is configured, otherwise the
 * static PIN set on the target machine.
 */
export async function startSession(targetDeviceId: string): Promise<StartResult> {
  const request = ++sessionRequest
  const res = await api<{ id?: string; error?: string; message?: string; method?: string; sentTo?: string }>(
    SESSION_PATH,
    { method: 'POST', body: { action: 'start', targetDeviceId } }
  )
  if (request !== sessionRequest) {
    if (res.ok && res.data?.id) void api(SESSION_PATH, { method: 'POST', body: { action: 'end', id: res.data.id } }).catch(() => {})
    return { ok: false, reason: 'failed', message: 'Session cancelled.' }
  }
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
  return { ok: false, reason: 'failed', message: res.data?.message || "Couldn't start a session with that device." }
}

export type VerifyResult = { ok: true } | { ok: false; attemptsLeft: number; message: string }

/** Hand over the PIN. Only on success does the session start accepting input. */
export async function verifyPin(pin: string): Promise<VerifyResult> {
  if (!sessionId) return { ok: false, attemptsLeft: 0, message: 'No session.' }
  const id = sessionId
  const res = await api<{ ok?: boolean; attemptsLeft?: number; message?: string }>(SESSION_PATH, {
    method: 'POST',
    body: { action: 'verify', id, pin },
  })
  if (sessionId !== id) return { ok: false, attemptsLeft: 0, message: 'Session cancelled.' }
  if (res.ok && res.data?.ok) {
    startPumps()
    return { ok: true }
  }
  const left = res.data?.attemptsLeft ?? 0
  if (left <= 0) {
    // Out of attempts: the backend killed the session, so drop it here too
    // rather than leaving a dead id that quietly rejects everything.
    sessionId = null
    return { ok: false, attemptsLeft: 0, message: res.data?.message || 'Could not verify — start a new session.' }
  }
  return { ok: false, attemptsLeft: left, message: `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` }
}

export async function endSession(): Promise<void> {
  sessionRequest++
  const id = sessionId
  sessionId = null
  delivery = null
  stopPumps()
  closeViewerPeer()
  if (id) {
    try {
      await api(SESSION_PATH, { method: 'POST', body: { action: 'end', id } })
    } catch {
      // The target hangs up on its own once heartbeats stop.
    }
  }
}

/** Notify after changing the current, ready input channel (not just video). */
export function inputPathChanged(): void {
  delivery?.setPath(peerLive ? peer : null, peer?.retiredGeneration?.() ?? 0)
}

export function sendEvent(e: RemoteEvent): void {
  if (!sessionId || !delivery) return
  inputPathChanged()
  delivery.enqueue(e)
}

function flush(): void {
  inputPathChanged()
  void delivery?.flush()
}

function closeViewerPeer(): void {
  const wasReady = peerLive
  const owner = peerOwner
  peerOwner = null
  peerLive = false
  peer?.close()
  peer = null
  inputPathChanged()
  if (wasReady) owner?.onConnected(false)
}

/** Resolves on the first attempt's outcome. Subsequent drops/recoveries are
 * reported through onConnected until endSession closes the session owner. */
export async function connectPeer(
  onStream: (stream: MediaStream) => void,
  onConnected: (ready: boolean) => void = () => {},
): Promise<boolean> {
  const id = sessionId
  if (!id) return false
  if (peerOwner?.id === id && peer) {
    const handle = peer
    peerOwner.onStream = onStream
    peerOwner.onConnected = onConnected
    if (peerOwner.stream) onStream(peerOwner.stream)
    onConnected(peerLive)
    return (peerLive || await handle.firstAttempt) && peer === handle && peerLive
  }
  closeViewerPeer()
  const owner: ViewerOwner = { id, onStream, onConnected, stream: null }
  peerOwner = owner
  const current = () => peerOwner === owner && sessionId === id
  try {
    peer = startViewerPeer(id, stream => {
      if (!current()) return
      owner.stream = stream
      owner.onStream(stream)
    }, ready => {
      if (!current()) return
      peerLive = ready
      inputPathChanged()
      if (!ready) owner.stream = null
      owner.onConnected(ready)
    })
    return await peer.firstAttempt && current() && peerLive
  } catch {
    if (current()) closeViewerPeer()
    return false
  }
}

export async function getViewerStats(): Promise<RTCStatsReport | null> {
  const handle = peer
  if (!handle || !peerLive || peerOwner?.id !== sessionId) return null
  const report = await handle.stats()
  return handle === peer && peerLive && peerOwner?.id === sessionId ? report : null
}

const endedListeners = new Set<(id: string) => void>()
/** A confirmed server-side hang-up, not a transient loss of connectivity. */
export function onRemoteSessionEnded(cb: (id: string) => void): () => void {
  endedListeners.add(cb)
  return () => { endedListeners.delete(cb) }
}

function startPumps(): void {
  stopPumps()
  const id = sessionId
  if (!id) return
  delivery = new InputDelivery(async events => (await api(INPUT_PATH, { method: 'POST', body: { id, events } })).ok)
  flushTimer = window.setInterval(() => void flush(), FLUSH_MS)
  let beating = false
  beatTimer = window.setInterval(async () => {
    if (beating || id !== sessionId) return
    beating = true
    try {
      const res = await api(SESSION_PATH, { method: 'POST', body: { action: 'heartbeat', id } })
      if (sessionId === id && (res.status === 403 || res.status === 404)) {
        void endSession() // invalidates the input pump synchronously, before UI callbacks
        for (const cb of endedListeners) cb(id)
      }
    } catch { /* transient failure, try the next heartbeat */ }
    finally { beating = false }
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
