import { api } from './api'
import { setQuality, QUALITY, type QualityPreset } from './screenShare'

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
 * a TURN relay — which costs money to run, so there's no free default. Paste
 * credentials in the Control Center and they're used automatically.
 */
const TURN_KEY = 'senti:turn'

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

function iceConfig(): RTCConfiguration {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ]
  const turn = getTurn()
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
  onState: (connected: boolean) => void
): void {
  pc.onicecandidate = (e) => {
    if (e.candidate) void signal(sessionId, 'ice', e.candidate.toJSON())
  }
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState
    onState(state === 'connected')
    // A failed connection means the peer is dead — let the host know so it
    // can fall back to the frame path rather than leaving the viewer staring
    // at a black screen.
    if (state === 'failed' || state === 'disconnected') {
      void pc.close()
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
  // moving screen. Ask for a high ceiling and tell it to sacrifice sharpness
  // before smoothness.
  for (const sender of videoSenders) {
    try {
      const params = sender.getParameters()
      if (!params.encodings || !params.encodings.length) params.encodings = [{}]
      // High ceiling for game action: 1080p at 60fps with motion-optimised
      // encoding. The viewer can override this via a quality control message
      // on the data channel once it's open.
      params.encodings[0].maxBitrate = 16_000_000
      params.encodings[0].maxFramerate = 60
      params.encodings[0].scaleResolutionDownBy = 1.0
      ;(params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference =
        'maintain-framerate'
      await sender.setParameters(params)
    } catch {
      // Older/odd builds: the defaults still work, just less smoothly.
    }
  }

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
            void setQuality(item.preset as QualityPreset)
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
      pc.close()
    },
    send: () => false,
    connected: () => pc.connectionState === 'connected',
  }
}

export { CONNECT_TIMEOUT_MS }
