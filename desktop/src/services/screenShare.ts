import { api } from './api'

/**
 * Live screen sharing — the PC side.
 *
 * Grabs the desktop as a video stream, draws a frame to a canvas every so
 * often, encodes it as a downscaled JPEG, and uploads it. Your phone or laptop
 * reads the newest frame from the dashboard, so you get a live (if low-frame-
 * rate) view of this machine from anywhere.
 *
 * Deliberately NOT high-frame-rate video: one small frame every second keeps it
 * cheap, works through NAT with zero setup, and is plenty to glance at your PC.
 * Smooth real-time video (WebRTC) is a later upgrade.
 *
 * This only ever runs while YOU turn it on, and the orb shows a visible
 * indicator the whole time it's streaming — it is remote access to your own
 * machine, never a hidden capture. It also keeps the PC awake for the duration,
 * since a screen you can't see if the display sleeps isn't much of a feature.
 */
const SCREEN_PATH = '/api/device/screen'
const FRAME_INTERVAL_MS = 1000
/** While someone is actively driving this machine, ~5 fps instead of 1. */
const FAST_FRAME_MS = 200
let currentInterval = FRAME_INTERVAL_MS

/**
 * How to spend a limited connection.
 *
 * There's a real trade here and no universally right answer: at a fixed
 * bandwidth you can have more pixels or more frames, not both. Text stays
 * readable at 30fps; a game does not. So the viewer picks.
 */
export type QualityPreset = 'smooth' | 'balanced' | 'sharp'

export const QUALITY: Record<QualityPreset, { width: number; height: number; fps: number; bitrate: number; label: string }> = {
  // Fewer pixels, every frame — what a game needs.
  smooth: { width: 1280, height: 720, fps: 60, bitrate: 8_000_000, label: '720p60 — smoothest' },
  balanced: { width: 1920, height: 1080, fps: 30, bitrate: 8_000_000, label: '1080p30 — balanced' },
  // Everything, if the link can carry it.
  sharp: { width: 1920, height: 1080, fps: 60, bitrate: 12_000_000, label: '1080p60 — sharpest' },
}

let quality: QualityPreset = 'balanced'

/**
 * Change quality on a LIVE stream — applyConstraints re-negotiates the capture
 * without tearing the session down, so the picture doesn't blank while you
 * try a setting.
 */
export async function setQuality(next: QualityPreset): Promise<void> {
  quality = next
  const q = QUALITY[next]
  for (const track of stream?.getVideoTracks() ?? []) {
    try {
      await track.applyConstraints({
        width: { ideal: q.width },
        height: { ideal: q.height },
        frameRate: { ideal: q.fps, max: q.fps },
      })
    } catch {
      // The camera/capture refused — keep whatever it was already doing.
    }
  }
}
/** Downscale so a frame stays small (~30-80 KB) and uploads quickly. */
const MAX_WIDTH = 1280
const JPEG_QUALITY = 0.5
/** Stop retrying uploads and give up the session after this many misses in a row. */
const MAX_CONSECUTIVE_FAILURES = 8

let stream: MediaStream | null = null
let video: HTMLVideoElement | null = null
let canvas: HTMLCanvasElement | null = null
let timer: number | null = null
let running = false
let consecutiveFailures = 0
let inFlight = false
/** True while a direct peer connection is carrying the video instead. */
let uploadPaused = false
/** Notified when sharing starts/stops, so the UI can show the indicator. */
const listeners = new Set<(on: boolean) => void>()

export function onScreenShareChange(cb: (on: boolean) => void): () => void {
  listeners.add(cb)
  cb(running)
  return () => listeners.delete(cb)
}

function emit(): void {
  for (const cb of listeners) {
    try {
      cb(running)
    } catch {
      // ignore a bad listener
    }
  }
}

/**
 * The live capture, for WebRTC to send directly to the controlling machine.
 * Starts capture if it isn't already running, so a peer connection never has
 * to care whether frame-uploading happened to be on.
 */
export async function getScreenStream(): Promise<MediaStream | null> {
  if (stream) return stream
  const ok = await startScreenShare()
  return ok ? stream : null
}

async function captureFrame(): Promise<void> {
  // A direct peer connection is already carrying the video; encoding and
  // uploading JPEGs on top of that is pure waste — CPU on this machine and
  // bandwidth that the video stream could be using instead.
  if (uploadPaused) return
  // Skip a tick rather than pile up requests if the network is slow.
  if (inFlight) return
  if (!video || !canvas || video.videoWidth === 0) return

  const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
  const w = Math.round(video.videoWidth * scale)
  const h = Math.round(video.videoHeight * scale)
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, 0, 0, w, h)

  const data = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  inFlight = true
  try {
    const res = await api(SCREEN_PATH, { method: 'POST', body: { data, sharing: true } })
    if (res.ok) {
      consecutiveFailures = 0
    } else {
      consecutiveFailures++
    }
  } catch {
    consecutiveFailures++
  } finally {
    inFlight = false
  }

  // A flaky connection shouldn't spin forever silently — after enough misses
  // in a row, stop cleanly so the UI reflects reality instead of pretending.
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    await stopScreenShare()
  }
}

export async function startScreenShare(): Promise<boolean> {
  if (running) return true

  try {
    // getDisplayMedia is the modern, reliable desktop-capture API. Paired with
    // main's setDisplayMediaRequestHandler, it hands back the primary screen
    // with no OS picker dialog to click through — it just starts.
    //
    // 60fps at 1080p is asked for because this stream now feeds WebRTC, where
    // frame rate IS the experience. (The JPEG fallback samples it far more
    // slowly on its own timer, so a high capture rate costs it nothing.)
    //
    // Audio comes along too: on Windows getDisplayMedia can capture system
    // loopback, so game and video sound reach the controlling machine. Some
    // setups refuse it, which is why the whole call retries without audio
    // rather than leaving you with no picture at all.
    const video = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } }
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: true })
    } catch {
      stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: false })
    }
  } catch {
    stream = null
    return false
  }

  // Tell the encoder this is moving imagery, not a static document. Without
  // it Chromium optimises for text sharpness and drops frame rate to keep
  // detail — exactly backwards for watching a game.
  for (const t of stream.getVideoTracks()) {
    try {
      ;(t as MediaStreamTrack & { contentHint: string }).contentHint = 'motion'
    } catch {
      // hint unsupported — the stream still works
    }
  }

  video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  await video.play().catch(() => {})
  canvas = document.createElement('canvas')
  consecutiveFailures = 0

  // If the capture ends on its own (display sleeps, driver hiccup), reflect
  // that immediately instead of silently uploading a frozen last frame.
  stream.getVideoTracks()[0]?.addEventListener('ended', () => void stopScreenShare())

  // A screen you can't see because the display went to sleep isn't a live
  // view — hold the machine awake for as long as you're watching it.
  void window.senti?.keepAwake?.(true, 'screenShare')

  running = true
  emit()
  void captureFrame()
  timer = window.setInterval(() => void captureFrame(), currentInterval)
  return true
}

/**
 * Speed the feed up while someone is actually DRIVING this machine.
 *
 * A frame a second is fine for glancing at your PC, but it's unusable for
 * control — you'd click where the cursor was a second ago. During a remote
 * session we push to ~5 fps, which is choppy but honest to work with, and drop
 * back the moment the session ends.
 */
/**
 * Stop uploading JPEGs while a direct connection carries the video.
 *
 * Capture keeps running (the peer is using that same stream) — only the
 * encode-and-upload work stops, which is the expensive half.
 */
export function pauseFrameUpload(paused: boolean): void {
  uploadPaused = paused
}

export function setFastFrames(fast: boolean): void {
  const next = fast ? FAST_FRAME_MS : FRAME_INTERVAL_MS
  if (next === currentInterval) return
  currentInterval = next
  if (running && timer !== null) {
    clearInterval(timer)
    timer = window.setInterval(() => void captureFrame(), currentInterval)
  }
}

export async function stopScreenShare(): Promise<void> {
  if (!running && !stream) return
  running = false
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  video = null
  canvas = null
  consecutiveFailures = 0
  emit()
  void window.senti?.keepAwake?.(false, 'screenShare')
  // Tell the backend the feed went cold so the viewer stops waiting.
  try {
    await api(SCREEN_PATH, { method: 'DELETE' })
  } catch {
    // ignore — it'll go stale on its own
  }
}
