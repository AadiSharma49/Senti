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

export function isSharing(): boolean {
  return running
}

async function captureFrame(): Promise<void> {
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
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 5 } },
      audio: false,
    })
  } catch {
    stream = null
    return false
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
  timer = window.setInterval(() => void captureFrame(), FRAME_INTERVAL_MS)
  return true
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
