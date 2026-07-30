import { useEffect, useRef, useState } from 'react'
import {
  startSession,
  verifyPin,
  endSession,
  sendEvent,
  targetFrame,
  connectPeer,
  type StartResult,
} from '../../services/remoteControl'

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
  const [direct, setDirect] = useState(false)
  /**
   * Game mode: the pointer is locked to this window and we send MOVEMENT
   * rather than positions. Games capture the mouse and read raw deltas for
   * camera control, so absolute jumps are unusable for them — this is the
   * difference between "watchable" and "playable".
   */
  const [locked, setLocked] = useState(false)
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
        setMessage(`Enter the remote PIN for ${deviceName}.`)
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
    void (async () => {
      const ok = await connectPeer((stream) => {
        if (!alive) return
        const v = videoRef.current
        if (v && v.srcObject !== stream) v.srcObject = stream
      })
      if (alive && ok) setDirect(true)
    })()
    return () => {
      alive = false
    }
  }, [phase])

  // Frame fallback: only while the direct connection isn't carrying video.
  useEffect(() => {
    if (phase !== 'live' || direct) return
    let alive = true
    const pull = async () => {
      const f = await targetFrame(deviceId)
      if (alive && f) setFrame(f)
    }
    void pull()
    const t = setInterval(() => void pull(), 250)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [phase, direct, deviceId])

  // Keyboard goes to the target while we're live. Capture phase so the app's
  // own shortcuts don't swallow keys meant for the other machine.
  useEffect(() => {
    if (phase !== 'live') return
    const onKey = (e: KeyboardEvent) => {
      // Escape is the way out; it must stay local or you could never leave.
      // In game mode the browser uses it to release the captured mouse, so
      // the first press only unlocks — otherwise stepping out of a game would
      // also hang up the session, which nobody wants.
      if (e.key === 'Escape') {
        if (document.pointerLockElement) return
        onClose()
        return
      }
      e.preventDefault()
      const mods: string[] = []
      if (e.ctrlKey) mods.push('ctrl')
      if (e.shiftKey) mods.push('shift')
      if (e.altKey) mods.push('alt')

      // A single printable character with no ctrl/alt is text; anything else
      // is a named key the target maps to a virtual-key code.
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey) sendEvent({ t: 'type', text: e.key })
      else sendEvent({ t: 'key', k: e.key, mods })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase, onClose])

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

  // Track pointer lock, including the user escaping it with the OS shortcut.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement === surfaceRef.current)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  const toggleLock = () => {
    if (document.pointerLockElement) document.exitPointerLock()
    else void surfaceRef.current?.requestPointerLock()
  }

  const onMove = (e: React.MouseEvent) => {
    const now = Date.now()
    // Over a direct connection there's no HTTP round trip, so we can sample at
    // ~60Hz and the pointer feels attached to your hand. On the relay path
    // that rate would just queue up requests, so stay at ~20Hz there.
    if (now - lastMove.current < (direct ? 16 : 50)) return
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
            {phase !== 'live'
              ? 'connecting'
              : direct
              ? 'direct connection — smooth, your mouse and keyboard control this machine'
              : 'connected via relay — negotiating a direct link for smoother video'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {phase === 'live' && (
            <button
              onClick={toggleLock}
              title="Capture the mouse and send movement instead of position — needed for games"
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                locked
                  ? 'border-accent bg-accent text-black'
                  : 'border-white/15 text-white/80 hover:bg-white/10'
              }`}
            >
              {locked ? 'Game mode on' : 'Game mode'}
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
          className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
          onMouseMove={onMove}
          onMouseDown={onClick}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => sendEvent({ t: 'scroll', d: e.deltaY })}
        >
          {/* Direct video: full size, smooth. */}
          {/* NOT muted: the target's system audio rides the same connection,
              so game and video sound come through here too. */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`h-full w-full cursor-crosshair select-none object-contain ${direct ? '' : 'hidden'}`}
          />
          {/* Fallback still frames until (or unless) the direct link comes up. */}
          {!direct &&
            (frame ? (
              <img
                ref={imgRef}
                src={frame}
                alt={`${deviceName} screen`}
                draggable={false}
                className="h-full w-full cursor-crosshair select-none object-contain"
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
                <div className="mb-1 text-lg font-semibold">Remote PIN</div>
                <p className="mb-4 text-sm text-white/50">{message}</p>
                <input
                  autoFocus
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitPin()}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-accent/60"
                  placeholder="••••"
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
