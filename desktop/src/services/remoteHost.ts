import { api } from './api'
import {
  startScreenShare,
  setFastFrames,
  getScreenStream,
  pauseFrameUpload,
  setQuality,
  QUALITY,
  type QualityPreset,
} from './screenShare'
import { startHostPeer, type PeerHandle } from './webrtc'

/**
 * Being controlled — the receiving half of remote control.
 *
 * This machine asks "is one of my other devices driving me right now?", and if
 * so it drains the input queue and hands the events to Windows, speeds its
 * screen feed up so the driver isn't clicking at a stale picture, and puts an
 * unmissable banner on screen.
 *
 * The banner is not decoration. Someone else operating your computer must
 * never be a silent state, and the banner's button ends the session instantly
 * from this side — whoever is physically at the machine always wins.
 */
const SESSION_PATH = '/api/device/remote/session'
const INPUT_PATH = '/api/device/remote/input'
/** Fast enough to feel connected, slow enough not to hammer the backend. */
const POLL_MS = 150
/** When nobody is driving, checking every 150ms is pure waste. */
const IDLE_POLL_MS = 4000

let timer: number | null = null
let busy = false
/** Explicit, so a tick already in flight when we stop can't reschedule itself. */
let hostRunning = false
let activeSessionId: string | null = null
/** The direct peer connection, when one is up. */
let peer: PeerHandle | null = null
let peerConnected = false
const listeners = new Set<(on: boolean) => void>()

/** Notified when this machine starts/stops being remotely controlled. */
export function onControlledChange(cb: (on: boolean) => void): () => void {
  listeners.add(cb)
  cb(!!activeSessionId)
  return () => listeners.delete(cb)
}

function emit(): void {
  for (const cb of listeners) {
    try {
      cb(!!activeSessionId)
    } catch {
      // a bad listener must not stop the session
    }
  }
}

function schedule(ms: number): void {
  if (timer !== null) clearTimeout(timer)
  if (!hostRunning) return
  timer = window.setTimeout(() => void tick(), ms)
}

async function tick(): Promise<void> {
  if (busy) return
  busy = true
  let nextDelay = IDLE_POLL_MS
  try {
    const res = await api<{ session?: { id: string } | null }>(SESSION_PATH)
    const session = res.ok ? res.data?.session ?? null : null

    if (!session) {
      if (activeSessionId) await endLocally()
      return
    }

    if (session.id !== activeSessionId) {
      // A session just began: make sure the driver can actually see something.
      activeSessionId = session.id
      setFastFrames(true)
      void startScreenShare()
      void window.senti?.keepAwake?.(true, 'remoteControl')
      emit()
      void openPeer(session.id)
    }

    // Keep draining the HTTP queue even with a peer up: it's the fallback
    // path, and anything already queued there still deserves to be applied.
    const inp = await api<{ events?: unknown[] }>(INPUT_PATH)
    const events = inp.ok ? inp.data?.events ?? [] : []
    if (events.length) await window.senti?.remoteInput?.(events)

    // A direct connection carries the video, so uploading JPEGs is pure waste.
    pauseFrameUpload(peerConnected)
    setFastFrames(!peerConnected)
    // With a peer up, the HTTP queue is only a fallback — poll it lazily.
    nextDelay = peerConnected ? 1000 : POLL_MS
  } catch {
    // Offline — fall back to the idle cadence and try again.
  } finally {
    busy = false
    schedule(nextDelay)
  }
}

/**
 * Sort what arrives on the data channel.
 *
 * It carries two kinds of message: input to replay, and control messages from
 * the viewer (currently only a quality change). Control messages must never
 * reach the input injector — an unrecognised event there is at best ignored
 * and at worst a stray click.
 */
async function applyIncoming(events: unknown[]): Promise<void> {
  const input: unknown[] = []
  for (const e of events) {
    const ev = e as { t?: string; preset?: string }
    if (ev?.t === 'quality' && ev.preset && ev.preset in QUALITY) {
      await setQuality(ev.preset as QualityPreset)
      continue
    }
    input.push(e)
  }
  if (input.length) await window.senti?.remoteInput?.(input)
}

/**
 * Offer this machine's screen over a direct connection, and take input back on
 * the data channel. If it never connects, the frame + HTTP path is still
 * running underneath, so control degrades instead of breaking.
 */
async function openPeer(sessionId: string): Promise<void> {
  closePeer()
  try {
    const screen = await getScreenStream()
    if (!screen) return
    peer = await startHostPeer(
      sessionId,
      screen,
      (events) => void applyIncoming(events),
      (ok) => {
        peerConnected = ok
      }
    )
  } catch {
    closePeer()
  }
}

function closePeer(): void {
  try {
    peer?.close()
  } catch {
    // already gone
  }
  peer = null
  peerConnected = false
  // The fallback path has to come back to life, or losing the peer would
  // leave the viewer staring at a frozen picture.
  pauseFrameUpload(false)
}

/** Tear down the controlled state on this side. */
async function endLocally(): Promise<void> {
  activeSessionId = null
  closePeer()
  setFastFrames(false)
  void window.senti?.remoteInputStop?.()
  void window.senti?.keepAwake?.(false, 'remoteControl')
  emit()
}

/** Hang up from the machine being controlled — always available, always wins. */
export async function endControlSession(): Promise<void> {
  const id = activeSessionId
  await endLocally()
  if (id) {
    try {
      await api(SESSION_PATH, { method: 'POST', body: { action: 'end', id } })
    } catch {
      // It'll go stale on its own if the call didn't land.
    }
  }
}

export function startRemoteHost(): void {
  if (hostRunning) return
  hostRunning = true
  schedule(0)
}

export function stopRemoteHost(): void {
  hostRunning = false
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  void endLocally()
}
