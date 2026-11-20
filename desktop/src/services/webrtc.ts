import { api } from './api'
import { getQuality, QUALITY, type QualityPreset } from './screenShare'

/**
 * Peer-to-peer remote control: real video, real-time input.
 *
 * The frame-relay path (JPEG -> Postgres -> poll) works but is inherently
 * slow and expensive — a few frames a second and hundreds of KB/s written to
 * the database. WebRTC replaces it: the two machines find each other through
 * a brief handshake, then the screen video and every keystroke flow DIRECTLY
 * between them. Smooth, and the content stops touching our server entirely.
 *
 * Input rides a data channel rather than HTTP, which removes the ~150ms poll
 * from every click — the single biggest reason the old path felt laggy.
 *
 * Honest limitation: with STUN alone, most home networks connect directly but
 * a symmetric NAT (some corporate and mobile networks) can't. Add TURN
 * credentials in the Control Center to cover that case; without them the
 * caller falls back to the frame path rather than showing a black screen.
 */
const SIGNAL_PATH = '/api/device/remote/signal'

/**
 * STUN lets two machines discover each other's public address; that's enough
 * on most home networks. Behind a symmetric NAT it isn't, and the only fix is
 * a TURN relay. A default can be baked in at build time (VITE_TURN_URL /
 * VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL — e.g. a free Metered.ca relay or
 * a self-hosted coturn box); pasting credentials in the Control Center
 * always overrides that default for this install.
 */
const TURN_KEY = 'senti:turn'

const BUILD_TURN_URL = (import.meta.env.VITE_TURN_URL as string | undefined) || ''
const BUILD_TURN_USERNAME = (import.meta.env.VITE_TURN_USERNAME as string | undefined) || ''
const BUILD_TURN_CREDENTIAL = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || ''

export interface TurnConfig {
  urls: string
  username?: string
  credential?: string
}

export function getTurn(): TurnConfig | null {
  try {
    const raw = localStorage.getItem(TURN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.urls === 'string' && parsed.urls ? parsed : null
  } catch {
    return null
  }
}

export function setTurn(cfg: TurnConfig | null): void {
  try {
    if (cfg?.urls) localStorage.setItem(TURN_KEY, JSON.stringify(cfg))
    else localStorage.removeItem(TURN_KEY)
  } catch {
    // storage unavailable — STUN-only for this session
  }
}

/** A build-time TURN default, used only when nothing's been pasted in Settings. */
function buildTimeTurn(): TurnConfig | null {
  return BUILD_TURN_URL ? { urls: BUILD_TURN_URL, username: BUILD_TURN_USERNAME, credential: BUILD_TURN_CREDENTIAL } : null
}

function iceConfig(): RTCConfiguration {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ]
  const turn = getTurn() || buildTimeTurn()
  if (turn) {
    servers.push({ urls: turn.urls, username: turn.username, credential: turn.credential })
  }
  return { iceServers: servers }
}
/**
 * Handshake polling.
 *
 * Connecting takes several round trips — offer, answer, then a stream of ICE
 * candidates — and each one waits on a poll. At 700ms that added seconds of
 * staring at a blank screen before video appeared, which is most of what
 * "taking control is slow" actually was. So: poll fast while negotiating,
 * then back right off once connected, since a settled connection has almost
 * nothing left to say.
 */
const POLL_FAST_MS = 350
const POLL_IDLE_MS = 2000
/** If the peers can't connect in this long, the caller falls back. */
const CONNECT_TIMEOUT_MS = 15_000

export interface PeerHandle {
  close: () => void
  send: (event: unknown) => boolean
  connected: () => boolean
  /** HTTP actions must be newer than the last direct attempt the host retired. */
  retiredGeneration: () => number
}
export interface ViewerHandle extends PeerHandle {
  firstAttempt: Promise<boolean>
  stats: () => Promise<RTCStatsReport | null>
}

type SignalKind = 'offer' | 'answer' | 'ice'
interface Envelope { generation: number; data: unknown }
const MAX_PENDING_ICE = 64

async function signal(id: string, generation: number, kind: SignalKind, data: unknown): Promise<void> {
  const res = await api(SIGNAL_PATH, {
    method: 'POST', body: { id, kind, payload: JSON.stringify({ generation, data }) },
  })
  if (!res.ok) throw new Error('Signalling unavailable')
}

/** One destructive mailbox reader for the entire session, not one per offer. */
function pollSignals(
  id: string,
  onSignal: (kind: SignalKind, message: Envelope) => Promise<void>,
  idle: () => boolean,
): () => void {
  let alive = true
  let timer: number | undefined
  const tick = async () => {
    try {
      const res = await api<{ signals?: { kind: SignalKind; payload: string }[] }>(
        `${SIGNAL_PATH}?id=${encodeURIComponent(id)}`,
      )
      if (!res.ok) return
      for (const row of res.data?.signals ?? []) {
        if (!alive) break
        try {
          const msg = JSON.parse(row.payload) as Envelope
          if (Number.isSafeInteger(msg.generation) && msg.generation > 0) await onSignal(row.kind, msg)
        } catch { /* ignore malformed messages */ }
      }
    } catch { /* retry on the next tick */ }
    finally {
      if (alive) timer = window.setTimeout(tick, idle() ? POLL_IDLE_MS : POLL_FAST_MS)
    }
  }
  void tick()
  return () => { alive = false; clearTimeout(timer) }
}

/** Owns everything tied to one SDP negotiation. Closing never stops shared capture tracks. */
class Attempt {
  readonly pc = new RTCPeerConnection(iceConfig())
  channel: RTCDataChannel | null = null
  closed = false
  ready = false
  private video: MediaStreamTrack | null = null
  private pending: RTCIceCandidateInit[] = []
  private deadline: number
  setCeiling?: (preset: QualityPreset) => void

  constructor(
    private id: string,
    readonly generation: number,
    private onReady: () => void,
    readonly fail: () => void,
  ) {
    this.deadline = window.setTimeout(fail, CONNECT_TIMEOUT_MS)
    this.pc.onicecandidate = ({ candidate }) => {
      if (!this.closed && candidate) void signal(id, generation, 'ice', candidate.toJSON()).catch(() => {})
    }
    this.pc.onconnectionstatechange = this.update
  }

  usable(): boolean {
    return !this.closed && this.pc.connectionState === 'connected' &&
      this.video?.readyState === 'live' && this.channel?.readyState === 'open'
  }

  private update = () => {
    if (this.closed) return
    const state = this.pc.connectionState
    if (state === 'disconnected' || state === 'failed' || state === 'closed') return this.fail()
    // 'new'/'connecting' are not disconnect notifications. Only promote once
    // the negotiated video transport AND the reliable input channel are usable.
    if (this.usable()) {
      clearTimeout(this.deadline)
      if (!this.ready) { this.ready = true; this.onReady() }
    } else if (this.ready && state === 'connecting') {
      clearTimeout(this.deadline)
      this.deadline = window.setTimeout(this.fail, CONNECT_TIMEOUT_MS)
    }
  }

  setVideo(track: MediaStreamTrack) {
    this.video?.removeEventListener('ended', this.fail)
    this.video = track
    track.addEventListener('ended', this.fail)
    this.update()
  }

  bind(channel: RTCDataChannel): boolean {
    if (this.closed || this.channel || channel.label !== 'input' || !channel.ordered ||
        channel.maxRetransmits != null || channel.maxPacketLifeTime != null) {
      channel.close()
      return false
    }
    this.channel = channel
    channel.onopen = this.update
    channel.onclose = channel.onerror = this.fail
    this.update()
    return true
  }

  async ice(data: unknown) {
    if (this.closed) return
    const candidate = data as RTCIceCandidateInit
    if (this.pc.remoteDescription) await this.pc.addIceCandidate(candidate).catch(() => {})
    else if (this.pending.length < MAX_PENDING_ICE) this.pending.push(candidate)
  }

  async remote(data: unknown, kind: 'offer' | 'answer') {
    const desc = data as RTCSessionDescriptionInit
    if (desc?.type !== kind) throw new Error('Unexpected SDP type')
    await this.pc.setRemoteDescription(desc)
    for (const candidate of this.pending.splice(0)) await this.ice(candidate)
  }

  async local(kind: 'offer' | 'answer') {
    if (this.closed) return
    const desc = await (kind === 'offer' ? this.pc.createOffer() : this.pc.createAnswer())
    if (this.closed) return
    await this.pc.setLocalDescription(desc)
    if (!this.closed) await signal(this.id, this.generation, kind, desc)
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.ready = false
    clearTimeout(this.deadline)
    this.setCeiling = undefined
    this.video?.removeEventListener('ended', this.fail)
    this.pending = []
    this.pc.onconnectionstatechange = this.pc.onicecandidate = null
    this.pc.ontrack = this.pc.ondatachannel = null
    if (this.channel) {
      this.channel.onmessage = this.channel.onopen = this.channel.onclose = this.channel.onerror = null
      this.channel.close()
    }
    this.pc.close()
  }
}

// Strictly increasing within the viewer process, including if a component
// reattaches. The authenticated session ID isolates different viewers.
let nextGeneration = 0

export function startViewerPeer(
  id: string,
  onStream: (stream: MediaStream) => void,
  onConnected: (ready: boolean) => void,
): ViewerHandle {
  let active: Attempt | null = null
  let lastRetired = 0
  let closed = false
  let retry: number | undefined
  let backoff = 1000
  let settle!: (ok: boolean) => void
  const firstAttempt = new Promise<boolean>(resolve => { settle = resolve })

  const offer = () => {
    if (closed) return
    const generation = ++nextGeneration
    let retired = false
    const fail = () => {
      if (closed || retired || (active && active.generation !== generation)) return
      retired = true
      // The host might have seen ready even if our video callback never ran.
      lastRetired = generation
      const wasReady = active?.ready
      active?.close()
      active = null
      settle(false)
      retry = window.setTimeout(offer, backoff)
      backoff = Math.min(30_000, backoff * 2)
      if (wasReady) onConnected(false)
    }
    try {
      const a = active = new Attempt(id, generation, () => {
        backoff = 1000
        settle(true)
        onConnected(true)
      }, fail)
      const tx = a.pc.addTransceiver('video', { direction: 'recvonly' })
      a.pc.addTransceiver('audio', { direction: 'recvonly' })
      try {
        const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs ?? []
        const h264 = codecs.filter(c => /h264/i.test(c.mimeType))
        if (h264.length) tx.setCodecPreferences([...h264, ...codecs.filter(c => !h264.includes(c))])
      } catch { /* codec preferences are optional */ }
      a.bind(a.pc.createDataChannel('input', { ordered: true }))
      a.pc.ontrack = ({ streams, track }) => {
        if (active !== a || track.kind !== 'video') return
        onStream(streams[0] ?? new MediaStream([track]))
        if (active === a) a.setVideo(track)
      }
      void a.local('offer').catch(() => { if (active === a) fail() })
    } catch { fail() }
  }

  offer()
  const stopPoll = pollSignals(id, async (kind, msg) => {
    const a = active
    if (!a || msg.generation !== a.generation) return
    try {
      if (kind === 'answer' && !a.pc.remoteDescription) await a.remote(msg.data, 'answer')
      if (kind === 'ice') await a.ice(msg.data)
    } catch { if (active === a) a.fail() }
  }, () => !active || active.ready)
  return {
    firstAttempt,
    retiredGeneration: () => lastRetired,
    connected: () => active?.ready ?? false,
    close: () => {
      closed = true
      stopPoll()
      clearTimeout(retry)
      active?.close()
      active = null
      settle(false)
    },
    send: event => {
      if (!active?.ready || active.channel?.readyState !== 'open') return false
      try { active.channel.send(JSON.stringify(event)); return true } catch { return false }
    },
    stats: async () => {
      const a = active
      if (!a?.ready || !a.usable()) return null
      try {
        const report = await a.pc.getStats()
        return a === active && a.usable() ? report : null
      } catch { return null }
    },
  }
}

type DegradationPreference = 'balanced' | 'maintain-framerate' | 'maintain-resolution'

/** How to spend headroom when the link can't carry the full ceiling, per preset. */
function degradationPreferenceFor(preset: QualityPreset): DegradationPreference {
  // smooth = explicitly "what a game needs" (screenShare.ts) — motion matters
  // more than pixels, so give up resolution before frame rate.
  if (preset === 'smooth') return 'maintain-framerate'
  // sharp = "everything, if the link can carry it" — the opposite trade.
  if (preset === 'sharp') return 'maintain-resolution'
  return 'balanced'
}

/** WebRTC's native congestion controller chooses the operating rate. We only
 * set ceilings. Coalesce preset changes; overlapping setParameters calls can
 * invalidate each other's parameter transaction, even on a healthy sender. */
function ceilingSetter(a: Attempt, senders: RTCRtpSender[]): (preset: QualityPreset) => void {
  let desired: QualityPreset | null = null
  let busy = false
  const apply = async () => {
    busy = true
    try {
      while (desired && !a.closed) {
        const preset: QualityPreset = desired
        desired = null
        for (const sender of senders) {
          if (a.closed) return
          try {
            const params = sender.getParameters()
            if (!params.encodings?.length) continue
            const q = QUALITY[preset]
            params.encodings[0].maxBitrate = q.bitrate
            params.encodings[0].maxFramerate = q.fps
            params.degradationPreference = degradationPreferenceFor(preset)
            await sender.setParameters(params)
          } catch { /* unsupported parameters: keep the browser's defaults */ }
        }
      }
    } finally { busy = false }
  }
  return preset => {
    if (a.closed || a.pc.localDescription?.type !== 'answer') return
    desired = preset
    if (!busy) void apply()
  }
}

/**
 * The HOST: answers the offer, sends its screen, and applies whatever arrives
 * on the input channel.
 */
function configureHost(a: Attempt, screen: MediaStream, onInput: (events: unknown[]) => void): void {
  const pc = a.pc
  const video = screen.getVideoTracks()[0]
  if (!video || video.readyState === 'ended') throw new Error('No live screen')
  a.setVideo(video)
  const videoSenders: RTCRtpSender[] = []
  for (const track of screen.getVideoTracks()) videoSenders.push(pc.addTrack(track, screen))
  // System audio, when the OS allowed us to capture it.
  for (const track of screen.getAudioTracks()) pc.addTrack(track, screen)

  a.setCeiling = ceilingSetter(a, videoSenders)

  pc.ondatachannel = (e) => {
    const ch = e.channel
    if (!a.bind(ch)) return
    ch.onmessage = (msg) => {
      if (!a.ready || a.closed) return
      try {
        const parsed = JSON.parse(String(msg.data))
        onInput(Array.isArray(parsed) ? parsed : [parsed])
      } catch {
        // Ignore anything we can't read; never trust the wire blindly.
      }
    }
  }
}

export interface HostHandle extends PeerHandle {
  setSenderQuality: (preset: QualityPreset) => void
}

/** A passive mailbox listener. Only a newer viewer offer may start a peer. */
export function startHostPeer(
  sessionId: string,
  screen: MediaStream,
  onInput: (events: unknown[]) => void,
  onConnected: (ready: boolean) => void,
): HostHandle {
  let active: Attempt | null = null
  let generation = 0
  let lastReadyRetired = 0
  const earlyIce = new Map<number, unknown[]>()
  const drop = () => {
    const wasReady = active?.ready
    if (active?.ready) lastReadyRetired = active.generation
    active?.close()
    active = null
    if (wasReady) onConnected(false)
  }
  const stopPoll = pollSignals(sessionId, async (kind, msg) => {
    if (msg.generation < generation) return
    if (kind === 'ice') {
      if (msg.generation === generation) await active?.ice(msg.data)
      else {
        // Candidate POSTs can beat the offer POST even for a brand new peer.
        if (!earlyIce.has(msg.generation) && earlyIce.size < 4) earlyIce.set(msg.generation, [])
        const pending = earlyIce.get(msg.generation)
        if (pending && pending.length < MAX_PENDING_ICE) pending.push(msg.data)
      }
      return
    }
    if (kind !== 'offer' || msg.generation <= generation) return
    generation = msg.generation
    drop()
    try {
      const a = active = new Attempt(sessionId, generation, () => onConnected(true), () => {
        if (active?.generation === msg.generation) drop()
      })
      configureHost(a, screen, onInput)
      await a.remote(msg.data, 'offer')
      for (const data of earlyIce.get(generation) ?? []) await a.ice(data)
      await a.local('answer')
      if (!a.closed) a.setCeiling?.(getQuality())
    } catch {
      if (active?.generation === msg.generation) drop()
    } finally {
      for (const n of earlyIce.keys()) if (n <= generation) earlyIce.delete(n)
    }
  }, () => !!active?.ready)
  return {
    retiredGeneration: () => lastReadyRetired,
    setSenderQuality: preset => active?.setCeiling?.(preset),
    close: () => { stopPoll(); earlyIce.clear(); drop() },
    send: () => false,
    connected: () => active?.ready ?? false,
  }
}
