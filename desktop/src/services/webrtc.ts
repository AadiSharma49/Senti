import { api } from './api'

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
 * Honest limitation: this uses public STUN and no TURN relay. On most home
 * networks the direct connection succeeds; behind a symmetric NAT (some
 * corporate and mobile networks) it can't, and the caller falls back to the
 * frame path rather than leaving you with a black screen.
 */
const SIGNAL_PATH = '/api/device/remote/signal'
const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}
const POLL_MS = 700
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
  onSignal: (kind: string, payload: unknown) => void
): () => void {
  let alive = true
  let busy = false
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
    }
  }
  void tick()
  const t = window.setInterval(() => void tick(), POLL_MS)
  return () => {
    alive = false
    clearInterval(t)
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
    onState(pc.connectionState === 'connected')
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
  const pc = new RTCPeerConnection(ICE)
  let stopPoll: (() => void) | null = null
  let channelOpen = false

  // We only receive video; we never send our own screen back.
  pc.addTransceiver('video', { direction: 'recvonly' })
  const channel = pc.createDataChannel('input', { ordered: true })
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

  stopPoll = pollSignals(sessionId, (kind, payload) => {
    if (kind === 'answer') {
      void pc.setRemoteDescription(payload as RTCSessionDescriptionInit)
    } else if (kind === 'ice') {
      void pc.addIceCandidate(payload as RTCIceCandidateInit).catch(() => {})
    }
  })

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
  const pc = new RTCPeerConnection(ICE)
  for (const track of screen.getVideoTracks()) pc.addTrack(track, screen)

  pc.ondatachannel = (e) => {
    const ch = e.channel
    ch.onmessage = (msg) => {
      try {
        // Batched or single — accept both so the viewer can coalesce moves.
        const parsed = JSON.parse(String(msg.data))
        onInput(Array.isArray(parsed) ? parsed : [parsed])
      } catch {
        // Ignore anything we can't read; never trust the wire blindly.
      }
    }
  }
  attach(pc, sessionId, onConnected)

  const stopPoll = pollSignals(sessionId, (kind, payload) => {
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
  })

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
