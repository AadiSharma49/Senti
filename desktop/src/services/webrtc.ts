import { api } from './api'
import { setQuality, getQuality, QUALITY, type QualityPreset } from './screenShare'

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
const POLL_FAST_MS = 200
const POLL_IDLE_MS = 2000
/** If the peers can't connect in this long, the caller falls back. */
const CONNECT_TIMEOUT_MS = 15_000

/**
 * Floors the adaptive loop won't go below even on a terrible link — the
 * ceiling it backs off FROM is whatever QUALITY preset is active (see
 * screenShare.ts), not a fixed value, since "smooth" (a game) and "sharp"
 * (static detail) want very different trade-offs.
 */
const MIN_BITRATE = 800_000
const MIN_FRAMERATE = 12
const STATS_INTERVAL_MS = 3000

export interface PeerHandle {
  close: () => void
  /** Send an input event over the data channel. False when it isn't open. */
  send: (event: unknown) => boolean
  connected: () => boolean
}

/** Post one signalling message to the other end. */
async function signal(sessionId: string, kind: string, payload: unknown): Promise<void> {
  try {
    await api(SIGNAL_PATH, { method: 'POST', body: { id: sessionId, kind, payload: JSON.stringify(payload) } })
  } catch {
    // A dropped candidate isn't fatal; ICE keeps trying with the rest.
  }
}

/** Poll for messages from the other end until stopped. */
function pollSignals(
  sessionId: string,
  onSignal: (kind: string, payload: unknown) => void,
  /** Once this returns true we're connected, so slow right down. */
  isConnected: () => boolean = () => false
): () => void {
  let alive = true
  let busy = false
  let timer: number | null = null

  const schedule = () => {
    if (!alive) return
    timer = window.setTimeout(() => void tick(), isConnected() ? POLL_IDLE_MS : POLL_FAST_MS)
  }

  const tick = async () => {
    if (!alive || busy) return
    busy = true
    try {
      const res = await api<{ signals?: { kind: string; payload: string }[] }>(
        `${SIGNAL_PATH}?id=${encodeURIComponent(sessionId)}`
      )
      for (const s of res.data?.signals ?? []) {
        if (!alive) return
        try {
          onSignal(s.kind, JSON.parse(s.payload))
        } catch {
          // Malformed message — skip it rather than tearing the session down.
        }
      }
    } catch {
      // Offline; the next tick retries.
    } finally {
      busy = false
      schedule()
    }
  }

  void tick()
  return () => {
    alive = false
    if (timer !== null) clearTimeout(timer)
  }
}

function attach(
  pc: RTCPeerConnection,
  sessionId: string,
  onState: (connected: boolean) => void,
  onDisconnected?: () => void
): void {
  pc.onicecandidate = (e) => {
    if (e.candidate) void signal(sessionId, 'ice', e.candidate.toJSON())
  }
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState
    onState(state === 'connected')
    if ((state === 'failed' || state === 'disconnected') && onDisconnected) {
      onDisconnected()
    }
  }
}

/**
 * The VIEWER: offers the connection, receives the screen, opens the input
 * channel. Resolves once video is flowing, or rejects so the caller can fall
 * back to frames.
 */
export async function startViewerPeer(
  sessionId: string,
  onStream: (stream: MediaStream) => void,
  onConnected: (ok: boolean) => void
): Promise<PeerHandle> {
  const pc = new RTCPeerConnection(iceConfig())
  let stopPoll: (() => void) | null = null
  let channelOpen = false
  let seq = 0

  // We only receive; we never send our own screen or mic back.
  const videoTx = pc.addTransceiver('video', { direction: 'recvonly' })
  pc.addTransceiver('audio', { direction: 'recvonly' })

  // Ask for H.264 ahead of VP8/VP9. Hardware decoders for H.264 are close to
  // universal, while VP9 often falls back to software — which on a modest
  // machine is the difference between smooth 1080p and a stuttering CPU pegged
  // at 100%. Negotiation still decides; this only states a preference.
  try {
    const caps = RTCRtpReceiver.getCapabilities('video')
    if (caps?.codecs && videoTx.setCodecPreferences) {
      const h264 = caps.codecs.filter((c) => /h264/i.test(c.mimeType))
      const rest = caps.codecs.filter((c) => !/h264/i.test(c.mimeType))
      if (h264.length) videoTx.setCodecPreferences([...h264, ...rest])
    }
  } catch {
    // Unsupported on this build — the default ordering still works.
  }
  // ordered:false + maxRetransmits:0 removes head-of-line blocking: every
  // click and mouse move ships immediately and stale ones are dropped rather
  // than waiting to be delivered in sequence. A sequence counter lets the host
  // discard anything older than what it has already applied.
  const channel = pc.createDataChannel('input', { ordered: false, maxRetransmits: 0 })
  channel.onopen = () => {
    channelOpen = true
  }
  channel.onclose = () => {
    channelOpen = false
  }

  pc.ontrack = (e) => {
    if (e.streams[0]) onStream(e.streams[0])
  }
  attach(pc, sessionId, onConnected)

  stopPoll = pollSignals(
    sessionId,
    (kind, payload) => {
      if (kind === 'answer') {
        void pc.setRemoteDescription(payload as RTCSessionDescriptionInit)
      } else if (kind === 'ice') {
        void pc.addIceCandidate(payload as RTCIceCandidateInit).catch(() => {})
      }
    },
    () => pc.connectionState === 'connected'
  )

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await signal(sessionId, 'offer', offer)

  return {
    close: () => {
      stopPoll?.()
      try {
        channel.close()
      } catch {
        // already closed
      }
      pc.close()
    },
    send: (event) => {
      if (!channelOpen || channel.readyState !== 'open') return false
      try {
        channel.send(JSON.stringify(event))
        return true
      } catch {
        return false
      }
    },
    connected: () => pc.connectionState === 'connected',
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

/**
 * Watches the outgoing video link and backs the encode off when it's clearly
 * struggling (rising packet loss or RTT), then eases it back up once things
 * recover. Simple step function, not full congestion control — just enough
 * that a weak uplink degrades gracefully instead of flooding the link and
 * making everything choppy.
 *
 * The ceiling it backs off FROM/recovers TOWARD is reconfigurable via
 * `setCeiling` — when the viewer picks a quality preset (e.g. "smooth" for a
 * game), the ceiling must move with it, or this loop just fights the choice
 * and quietly drags everything back to the old default.
 */
function startAdaptiveBitrate(
  pc: RTCPeerConnection,
  senders: RTCRtpSender[],
  initialBitrate: number,
  initialFramerate: number
): { stop: () => void; setCeiling: (bitrate: number, framerate: number) => void } {
  let ceilingBitrate = initialBitrate
  let ceilingFramerate = initialFramerate
  let bitrate = initialBitrate
  let framerate = initialFramerate
  let lastPacketsLost = 0
  let healthyStreak = 0

  const apply = async (): Promise<void> => {
    for (const sender of senders) {
      try {
        const params = sender.getParameters()
        if (!params.encodings?.length) continue
        params.encodings[0].maxBitrate = bitrate
        params.encodings[0].maxFramerate = framerate
        await sender.setParameters(params)
      } catch {
        // A renegotiation can race the connection closing — skip this tick.
      }
    }
  }

  const timer = window.setInterval(async () => {
    if (pc.connectionState !== 'connected') return
    try {
      const stats = await pc.getStats()
      let packetsLost = 0
      let rtt = 0
      stats.forEach((report) => {
        if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
          if (typeof report.packetsLost === 'number') packetsLost = report.packetsLost
          if (typeof report.roundTripTime === 'number') rtt = Math.max(rtt, report.roundTripTime)
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (typeof report.currentRoundTripTime === 'number') rtt = Math.max(rtt, report.currentRoundTripTime)
        }
      })
      const lossDelta = Math.max(0, packetsLost - lastPacketsLost)
      lastPacketsLost = packetsLost
      const struggling = lossDelta > 20 || rtt > 0.3

      if (struggling) {
        healthyStreak = 0
        const nextBitrate = Math.max(MIN_BITRATE, Math.floor(bitrate * 0.7))
        const nextFramerate = Math.max(MIN_FRAMERATE, framerate - 10)
        if (nextBitrate !== bitrate || nextFramerate !== framerate) {
          bitrate = nextBitrate
          framerate = nextFramerate
          await apply()
        }
      } else {
        healthyStreak++
        if (healthyStreak >= 3 && (bitrate < ceilingBitrate || framerate < ceilingFramerate)) {
          healthyStreak = 0
          bitrate = Math.min(ceilingBitrate, Math.floor(bitrate * 1.3))
          framerate = Math.min(ceilingFramerate, framerate + 5)
          await apply()
        }
      }
    } catch {
      // Stats unavailable this tick — try again next interval.
    }
  }, STATS_INTERVAL_MS)

  return {
    stop: () => window.clearInterval(timer),
    // A preset change (e.g. switching to "smooth" for a game) is a deliberate
    // choice, not a network condition — snap straight to it rather than
    // easing toward it over several healthy ticks.
    setCeiling: (nextBitrate: number, nextFramerate: number) => {
      ceilingBitrate = nextBitrate
      ceilingFramerate = nextFramerate
      bitrate = nextBitrate
      framerate = nextFramerate
      healthyStreak = 0
      void apply()
    },
  }
}

/**
 * The HOST: answers the offer, sends its screen, and applies whatever arrives
 * on the input channel.
 */
export async function startHostPeer(
  sessionId: string,
  screen: MediaStream,
  onInput: (events: unknown[]) => void,
  onConnected: (ok: boolean) => void
): Promise<PeerHandle> {
  const pc = new RTCPeerConnection(iceConfig())
  const videoSenders: RTCRtpSender[] = []
  for (const track of screen.getVideoTracks()) videoSenders.push(pc.addTrack(track, screen))
  // System audio, when the OS allowed us to capture it.
  for (const track of screen.getAudioTracks()) pc.addTrack(track, screen)

  // Left alone, WebRTC targets a conservative bitrate and will happily halve
  // the frame rate to protect image detail — which is exactly wrong for a
  // moving screen. Seed from whatever quality preset is active right now
  // (the viewer may have already requested "smooth" for a game before this
  // peer finished connecting) rather than a fixed default — a fixed
  // 16Mbps/60fps ceiling looked great on a LAN but overran most home
  // uplinks, which is a big part of why this felt laggy in practice.
  // startAdaptiveBitrate() below steps this down further in real time when
  // the link can't keep up, and back up toward the preset's ceiling when it
  // recovers; applyQualityToSenders() moves that ceiling when the viewer
  // picks a different preset mid-session.
  const applyQualityToSenders = async (preset: QualityPreset): Promise<void> => {
    const q = QUALITY[preset]
    const pref = degradationPreferenceFor(preset)
    for (const sender of videoSenders) {
      try {
        const params = sender.getParameters()
        if (!params.encodings || !params.encodings.length) params.encodings = [{}]
        params.encodings[0].maxBitrate = q.bitrate
        params.encodings[0].maxFramerate = q.fps
        params.encodings[0].scaleResolutionDownBy = 1.0
        ;(params as RTCRtpSendParameters & { degradationPreference?: DegradationPreference }).degradationPreference =
          pref
        await sender.setParameters(params)
      } catch {
        // Older/odd builds: the defaults still work, just less smoothly.
      }
    }
  }

  const initialQuality = QUALITY[getQuality()]
  await applyQualityToSenders(getQuality())
  const adaptive = startAdaptiveBitrate(pc, videoSenders, initialQuality.bitrate, initialQuality.fps)

  pc.ondatachannel = (e) => {
    const ch = e.channel
    ch.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(String(msg.data))
        // Batched input events or single — accept both.
        const input: any[] = []
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          // Control messages from the viewer: quality preset changes.
          if (item?.t === 'quality' && item.preset && item.preset in QUALITY) {
            const preset = item.preset as QualityPreset
            void setQuality(preset)
            void applyQualityToSenders(preset)
            adaptive.setCeiling(QUALITY[preset].bitrate, QUALITY[preset].fps)
            continue
          }
          input.push(item)
        }
        if (input.length) onInput(input)
      } catch {
        // Ignore anything we can't read; never trust the wire blindly.
      }
    }
  }
  attach(pc, sessionId, onConnected)

  const stopPoll = pollSignals(
    sessionId,
    (kind, payload) => {
      if (kind === 'offer') {
        void (async () => {
          await pc.setRemoteDescription(payload as RTCSessionDescriptionInit)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await signal(sessionId, 'answer', answer)
        })()
      } else if (kind === 'ice') {
        void pc.addIceCandidate(payload as RTCIceCandidateInit).catch(() => {})
      }
    },
    () => pc.connectionState === 'connected'
  )

  return {
    close: () => {
      stopPoll()
      adaptive.stop()
      pc.close()
    },
    send: () => false,
    connected: () => pc.connectionState === 'connected',
  }
}

export { CONNECT_TIMEOUT_MS }
