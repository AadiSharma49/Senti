import { viewerKeyboard } from './viewerKeyboard'
import { useEffect, useRef, useState } from 'react'
import {
  startSession,
  verifyPin,
  endSession,
  onRemoteSessionEnded,
  sendEvent,
  targetFrame,
  connectPeer,
  type StartResult,
} from '../../services/remoteControl'
import RemoteLinkStatus from './RemoteLinkStatus'
import { QUALITY, type QualityPreset } from '../../services/screenShare'

/**
 * Driving another machine: its screen fills this window, and your mouse and
 * keyboard go to it instead of here.
 *
 * Pointer positions are sent NORMALIZED against the displayed image, never in
 * pixels. The target's resolution has nothing to do with this window's size,
 * and normalizing is what lets a 1366x768 laptop drive a 4K desktop without
 * either end knowing the other's geometry.
 */
export default function RemoteControlWindow({
  deviceId,
  deviceName,
  onClose,
}: {
  deviceId: string
  deviceName: string
  onClose: () => void
}) {
  const [phase, setPhase] = useState<'connecting' | 'pin' | 'live' | 'error'>('connecting')
  const [message, setMessage] = useState('')
  const [pin, setPin] = useState('')
  const [frame, setFrame] = useState<string | null>(null)
  /** True once video is flowing peer-to-peer; false means the frame fallback. */
  const [rtcReady, setRtcReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [jpegFps, setJpegFps] = useState<number | null>(null)
  const direct = rtcReady && playing
  /**
   * Game mode: the pointer is locked to this window and we send MOVEMENT
   * rather than positions. Games capture the mouse and read raw deltas for
   * camera control, so absolute jumps are unusable for them — this is the
   * difference between "watchable" and "playable".
   */
  const [locked, setLocked] = useState(false)
  const [quality, setQuality] = useState<QualityPreset>('balanced')
  /** Whether we're waiting on an emailed code or the machine's static PIN. */
  const [viaEmail, setViaEmail] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const lastMove = useRef(0)

  // Open the session as soon as the window appears.
  useEffect(() => {
    let alive = true
    void (async () => {
      const res: StartResult = await startSession(deviceId)
      if (!alive) return
      if (res.ok) {
        setPhase('pin')
        setViaEmail(res.method === 'email')
        setMessage(
          res.method === 'email'
            ? `We sent a 6-digit code to ${res.sentTo}. It expires in 10 minutes.`
            : `Enter the remote PIN for ${deviceName}.`
        )
      } else {
        setPhase('error')
        setMessage(res.message)
      }
    })()
    return () => {
      alive = false
      void endSession()
    }
  }, [deviceId, deviceName])

  // Once we're live, try for a DIRECT connection — real video, real-time
  // input. The frame path keeps running underneath until it succeeds, so
  // there's never a black screen while ICE negotiates.
  useEffect(() => {
    if (phase !== 'live') return
    let alive = true
    const v = videoRef.current
    const unsubscribe = onRemoteSessionEnded(() => {
      if (!alive) return
      setRtcReady(false)
      setPlaying(false)
      setPhase('error')
      setMessage('This remote session has ended. Reconnect to start a new one.')
    })
    void connectPeer((stream) => {
      if (!alive || !v) return
      if (v.srcObject !== stream) {
        setPlaying(false)
        v.srcObject = stream
      }
      void v.play().catch(() => {})
    }, (ready) => {
      if (!alive) return
      setRtcReady(ready)
      if (!ready) setPlaying(false)
      else if (v && v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) setPlaying(true)
    })
    return () => {
      alive = false
      unsubscribe()
      if (v) v.srcObject = null
      void endSession()
    }
  }, [phase])

  // Frame fallback: only while the direct connection isn't carrying video.
  useEffect(() => {
    if (phase !== 'live' || direct) return
    let alive = true
    let inFlight = false
    let last: string | null = null
    let since = performance.now()
    let changed = 0
    setJpegFps(null)
    const pull = async () => {
      if (inFlight) return // never display an older, slower response after a newer one
      inFlight = true
      try {
        const f = await targetFrame(deviceId)
        if (!alive) return
        if (f !== last) { setFrame(f); if (f) changed++; last = f }
        const now = performance.now()
        if (now - since >= 2000) {
          setJpegFps(1000 * changed / (now - since))
          since = now
          changed = 0
        }
      } catch { /* keep the last picture on a transient read failure */ }
      finally { inFlight = false }
    }
    void pull()
    const t = setInterval(() => void pull(), 250)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [phase, direct, deviceId])

  // Re-renders (including cursor frames) must not tear down a live key hold.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (phase !== 'live') return
    const keys = viewerKeyboard(sendEvent, () => closeRef.current(), () => !!document.pointerLockElement)
    const visibility = () => { if (document.hidden) keys.reset() }
    window.addEventListener('keydown', keys.down, true)
    window.addEventListener('keyup', keys.up, true)
    window.addEventListener('blur', keys.reset)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('pointerlockchange', keys.reset)
    return () => {
      window.removeEventListener('keydown', keys.down, true)
      window.removeEventListener('keyup', keys.up, true)
      window.removeEventListener('blur', keys.reset)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('pointerlockchange', keys.reset)
      keys.reset()
    }
  }, [phase])

  /**
   * Where the pointer is on the REMOTE screen, 0..1.
   *
   * The element is letterboxed: `object-contain` fits the picture inside the
   * box and leaves bars on two sides. Measuring against the element's bounding
   * rect would therefore be wrong everywhere except a perfect aspect match —
   * clicks would drift steadily worse the more the aspect ratios differ. So we
   * work out where the picture ACTUALLY sits inside the box first.
   */
  const norm = (e: React.MouseEvent): { x: number; y: number } | null => {
    const el = direct ? videoRef.current : imgRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return null

    const iw = direct ? videoRef.current?.videoWidth ?? 0 : imgRef.current?.naturalWidth ?? 0
    const ih = direct ? videoRef.current?.videoHeight ?? 0 : imgRef.current?.naturalHeight ?? 0
    if (!iw || !ih) return null

    const scale = Math.min(r.width / iw, r.height / ih)
    const shownW = iw * scale
    const shownH = ih * scale
    const offX = (r.width - shownW) / 2
    const offY = (r.height - shownH) / 2

    const x = (e.clientX - r.left - offX) / shownW
    const y = (e.clientY - r.top - offY) / shownH
    // A click in the letterbox bar isn't on the remote screen at all.
    if (x < 0 || x > 1 || y < 0 || y > 1) return null
    return { x, y }
  }

  // Take the whole display for as long as we're driving, and give it back on
  // the way out — including if this unmounts for any other reason.
  useEffect(() => {
    void window.senti?.enterFullscreen?.()
    return () => {
      void window.senti?.exitFullscreen?.()
    }
  }, [])

  // Track pointer lock, including the user escaping it with the OS shortcut.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement === surfaceRef.current)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  const toggleLock = () => {
    if (!locked) {
      void surfaceRef.current?.requestPointerLock()?.catch(() => {})
    } else document.exitPointerLock()
  }

  // Reapply the effective preset after reconnection; Esc exits game mode just
  // like the button, returning to the user's selection rather than a stale cap.
  useEffect(() => {
    if (rtcReady) sendEvent({ t: 'quality', preset: locked ? 'smooth' : quality })
  }, [rtcReady, locked, quality])

  const onMove = (e: React.MouseEvent) => {
    const now = Date.now()
    // Over a direct connection there's no HTTP round trip, so we can sample at
    // ~60Hz and the pointer feels attached to your hand. On the relay path
    // that rate would just queue up requests, so stay at ~20Hz there.
    // Relative movement is distance, not a sampled position. The transport
    // coalesces deltas per flush; discarding them here makes turns stutter.
    if (!locked && now - lastMove.current < (direct ? 16 : 50)) return
    lastMove.current = now

    if (locked) {
      // Locked: the cursor isn't anywhere on screen, so position is
      // meaningless — send how far it moved instead.
      const dx = e.movementX
      const dy = e.movementY
      if (dx || dy) sendEvent({ t: 'moverel', x: dx, y: dy })
      return
    }
    const p = norm(e)
    if (p) sendEvent({ t: 'move', x: p.x, y: p.y })
  }

  const onClick = (e: React.MouseEvent) => {
    const b = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
    if (locked) {
      // No position to send — the host clicks wherever the pointer already is.
      sendEvent({ t: 'click', b, x: -1, y: -1, d: e.detail >= 2 ? 2 : 1 })
      return
    }
    const p = norm(e)
    if (!p) return
    sendEvent({ t: 'click', b, x: p.x, y: p.y, d: e.detail >= 2 ? 2 : 1 })
  }

  const submitPin = async () => {
    setMessage('Checking…')
    const res = await verifyPin(pin)
    setPin('')
    if (res.ok) {
      setPhase('live')
      setMessage('')
    } else {
      setMessage(res.message)
      if (res.attemptsLeft <= 0) setPhase('error')
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#070a0e] px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${phase === 'live' ? 'bg-green-400' : 'bg-amber-400'}`} />
          <span className="font-semibold">{deviceName}</span>
          <span className="text-white/40">
            {phase === 'live'
              ? <RemoteLinkStatus rtcReady={rtcReady} playing={playing} hasFallback={!!frame} jpegFps={jpegFps} />
              : 'connecting'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {phase === 'live' && direct && (
            <select
              value={locked ? 'smooth' : quality}
              disabled={locked}
              onChange={(e) => setQuality(e.target.value as QualityPreset)}
              title="More pixels or more frames — a fixed connection can't give you both"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white outline-none focus:border-accent/60"
            >
              {(Object.keys(QUALITY) as QualityPreset[]).map((k) => (
                <option key={k} value={k}>
                  {QUALITY[k].label}
                </option>
              ))}
            </select>
          )}
          {phase === 'live' && (
            <button
              onClick={toggleLock}
              title="Capture the mouse and send movement instead of position — needed for games"
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                locked
                  ? 'border-green-400 bg-green-400 text-black'
                  : 'border-white/15 text-white/80 hover:bg-white/10'
              }`}
            >
              {locked ? 'Playing — Esc to release' : 'Game mode'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            Disconnect (Esc)
          </button>
        </div>
      </div>

      {phase === 'live' ? (
        <div
          ref={surfaceRef}
          // Let the OS draw the local pointer; don't repaint React on every move.
          style={{ cursor: locked ? 'none' : 'default' }}
          className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
          onMouseMove={onMove}
          onMouseDown={onClick}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => {
            e.preventDefault()
            // Vertical scroll (deltaY) and horizontal (deltaX, e.g. trackpad
            // swipe or Shift+scroll) both get through.
            if (Math.abs(e.deltaY) > 0.5) sendEvent({ t: 'scroll', d: e.deltaY, axis: 'y' })
            if (Math.abs(e.deltaX) > 0.5) sendEvent({ t: 'scroll', d: e.deltaX, axis: 'x' })
          }}
        >
          {/* Direct video: full size, smooth. */}
          {/* muted: required for autoplay. System audio from the host rides
              the WebRTC audio track and reaches here regardless. */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onPlaying={() => setPlaying(true)}
            onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
            className={`absolute inset-0 h-full w-full select-none object-contain ${direct ? '' : 'opacity-0 pointer-events-none'}`}
          />
          {/* Fallback still frames until (or unless) the direct link comes up. */}
          {!direct &&
            (frame ? (
              <img
                ref={imgRef}
                src={frame}
                alt={`${deviceName} screen`}
                draggable={false}
                className="h-full w-full select-none object-contain"
              />
            ) : (
              <div className="text-sm text-white/40">Waiting for {deviceName}&apos;s screen…</div>
            ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-sm text-center">
            {phase === 'pin' && (
              <>
                <div className="mb-1 text-lg font-semibold">
                  {viaEmail ? 'Check your email' : 'Remote PIN'}
                </div>
                <p className="mb-4 text-sm text-white/50">{message}</p>
                <input
                  autoFocus
                  type={viaEmail ? 'text' : 'password'}
                  inputMode={viaEmail ? 'numeric' : 'text'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitPin()}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-accent/60"
                  placeholder={viaEmail ? '000000' : '••••'}
                />
                <button
                  onClick={() => void submitPin()}
                  className="mt-3 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-black"
                >
                  Connect
                </button>
              </>
            )}
            {phase === 'connecting' && <div className="text-sm text-white/50">Starting session…</div>}
            {phase === 'error' && (
              <>
                <div className="mb-2 text-lg font-semibold text-red-300">Can&apos;t connect</div>
                <p className="text-sm text-white/60">{message}</p>
                <button
                  onClick={onClose}
                  className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
