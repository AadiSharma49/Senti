import { api } from './api'
import {
  getScreenStream, releaseRemoteScreen, onScreenShareChange,
  setFastFrames, pauseFrameUpload, setQuality, QUALITY, type QualityPreset,
} from './screenShare'
import { startHostPeer, type HostHandle } from './webrtc'

const SESSION_PATH = '/api/device/remote/session'
const INPUT_PATH = '/api/device/remote/input'
const SESSION_MS = 1000
const IDLE_MS = 4000
const INPUT_MS = 300
// Even an IPC/HTTP request which never settles cannot extend permission indefinitely.
const SESSION_LEASE_MS = 6000

interface HostSession {
  id: string
  peer: HostHandle | null
  ready: boolean
  captured: boolean
  pathVersion: number
  lastSeq: number
  inputTimer?: number
  inputBusy: boolean
  lease?: number
  unsubscribe?: () => void
}

let active: HostSession | null = null
let running = false
let runVersion = 0
let timer: number | undefined
// A local hang-up wins even if the POST fails or a GET is already in flight.
let refusedId: string | null = null
const listeners = new Set<(on: boolean) => void>()

export function onControlledChange(cb: (on: boolean) => void): () => void {
  listeners.add(cb)
  cb(!!active)
  return () => listeners.delete(cb)
}

function emit(): void {
  for (const cb of listeners) {
    try { cb(!!active) } catch { /* keep the banner independent of other listeners */ }
  }
}

function endLocally(): void {
  const s = active
  if (!s) return
  active = null // Invalidate all pending capture, input, peer and lease callbacks first.
  clearTimeout(s.lease)
  clearTimeout(s.inputTimer)
  s.unsubscribe?.()
  s.peer?.close()
  releaseRemoteScreen()
  pauseFrameUpload(false)
  setFastFrames(false)
  void window.senti?.resetRemoteKeyState?.()
  void window.senti?.remoteInputStop?.()
  void window.senti?.keepAwake?.(false, 'remoteControl')
  emit()
}

export async function endControlSession(): Promise<void> {
  if (!active) return
  const id = refusedId = active.id
  endLocally()
  try { await api(SESSION_PATH, { method: 'POST', body: { action: 'end', id } }) }
  catch { /* refusedId still prevents readmission */ }
}

function renewLease(s: HostSession): void {
  clearTimeout(s.lease)
  s.lease = window.setTimeout(() => { if (active === s) void endControlSession() }, SESSION_LEASE_MS)
}

/** Both paths share a sequence watermark. Never replay queued HTTP actions
 * that predate a newer direct packet (including its initial key reset). */
function receive(s: HostSession, events: unknown[], relayFloor?: number): void {
  if (active !== s || !s.captured) return
  const input: unknown[] = []
  for (const e of events) {
    if (!e || typeof e !== 'object') continue
    const ev = e as { t?: string; seq?: number; preset?: string; relayFence?: number }
    // If the channel died before the first direct/reset packet, seq alone is
    // insufficient: even the newest received seq could be a pre-RTC click.
    // Compare the negotiated offer's ID, not two independent readiness counts.
    if (relayFloor !== undefined && ev.relayFence !== undefined &&
        (!Number.isSafeInteger(ev.relayFence) || ev.relayFence < relayFloor)) continue
    if (ev.seq !== undefined) {
      if (!Number.isSafeInteger(ev.seq) || ev.seq <= s.lastSeq) continue
      s.lastSeq = ev.seq
    } else if (s.lastSeq) continue // legacy fallback clients have no sequence numbers
    if (ev.t === 'quality') {
      if (ev.preset && Object.prototype.hasOwnProperty.call(QUALITY, ev.preset)) {
        const preset = ev.preset as QualityPreset
        void setQuality(preset)
        s.peer?.setSenderQuality(preset)
      }
    } else input.push(e)
  }
  if (input.length) void window.senti?.remoteInput?.(input).catch(() => {})
}

function scheduleInput(s: HostSession, ms: number): void {
  clearTimeout(s.inputTimer)
  if (active === s && s.captured && !s.ready && !s.inputBusy) {
    s.inputTimer = window.setTimeout(() => void drain(s), ms)
  }
}

async function drain(s: HostSession): Promise<void> {
  if (active !== s || s.ready || s.inputBusy) return
  const version = s.pathVersion
  s.inputBusy = true
  try {
    const res = await api<{ events?: unknown[] }>(`${INPUT_PATH}?id=${encodeURIComponent(s.id)}`)
    if (active !== s || s.pathVersion !== version) return
    if (!res.ok) {
      if ([0, 401, 403, 404].includes(res.status)) void endControlSession()
      return
    }
    receive(s, res.data?.events ?? [], s.peer?.retiredGeneration() ?? 0)
  } catch {
    if (active === s && s.pathVersion === version) void endControlSession()
  } finally {
    s.inputBusy = false
    scheduleInput(s, INPUT_MS)
  }
}

function setReady(s: HostSession, ready: boolean): void {
  if (active !== s || s.ready === ready) return
  s.ready = ready
  s.pathVersion++
  void window.senti?.resetRemoteKeyState?.()
  pauseFrameUpload(ready)
  setFastFrames(!ready)
  scheduleInput(s, 0)
}

async function acquire(s: HostSession): Promise<void> {
  try {
    const screen = await getScreenStream()
    if (active !== s) return // endLocally already released the remote capture claim
    if (!screen) { void endControlSession(); return }
    s.captured = true
    scheduleInput(s, 0)
    // One listener for this session. Fresh viewer offers replace only its PC.
    s.peer = startHostPeer(s.id, screen, events => {
      if (s.ready) receive(s, events)
    }, ready => setReady(s, ready))
  } catch {
    // Capture failure must not leave a blind input injector running. An RTC
    // setup failure after capture, however, can continue safely over HTTP.
    if (active === s && !s.captured) void endControlSession()
  }
}

function begin(id: string): void {
  endLocally()
  const s: HostSession = { id, peer: null, ready: false, captured: false, pathVersion: 0, lastSeq: 0, inputBusy: false }
  active = s
  renewLease(s)
  setFastFrames(true)
  void window.senti?.keepAwake?.(true, 'remoteControl')
  emit()
  if (active !== s) return
  let sawLiveCapture = false
  s.unsubscribe = onScreenShareChange(on => {
    if (on) sawLiveCapture = true
    else if (active === s && sawLiveCapture) void endControlSession()
  })
  void acquire(s)
}

/** Session authorization is checked independently of HTTP input and RTC
 * negotiation. In particular a healthy peer does not keep its own lease alive. */
async function checkSession(version: number): Promise<void> {
  const before = active
  try {
    const res = await api<{ session?: { id: string } | null }>(SESSION_PATH)
    if (version !== runVersion || before !== active) return
    if (!res.ok) {
      // A busy mailbox is not a revocation. It cannot renew the existing
      // short lease either: six seconds without a successful check fails shut.
      if (res.status !== 429 && res.status < 500) void endControlSession()
      return
    }
    const id = res.data?.session?.id
    if (!id || id === refusedId) endLocally()
    else if (active?.id === id) renewLease(active)
    else begin(id)
  } catch {
    if (version === runVersion && before === active) void endControlSession()
  } finally {
    if (version === runVersion && running) timer = window.setTimeout(() => void checkSession(version), active ? SESSION_MS : IDLE_MS)
  }
}

const offline = () => { void endControlSession() }

export function startRemoteHost(): void {
  if (running) return
  running = true
  const version = ++runVersion
  window.addEventListener('offline', offline)
  timer = window.setTimeout(() => void checkSession(version), 0)
}

export function stopRemoteHost(): void {
  running = false
  runVersion++
  clearTimeout(timer)
  window.removeEventListener('offline', offline)
  void endControlSession()
}
