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
 * machine, never a hidden capture.
 */
const SCREEN_PATH = '/api/device/screen'
const FRAME_INTERVAL_MS = 1000
/** Downscale so a frame stays small (~30-80 KB) and uploads quickly. */
const MAX_WIDTH = 1280
const JPEG_QUALITY = 0.5

let stream: MediaStream | null = null
let video: HTMLVideoElement | null = null
let canvas: HTMLCanvasElement | null = null
let timer: number | null = null
let running = false
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
  await api(SCREEN_PATH, { method: 'POST', body: { data, sharing: true } })
}

export async function startScreenShare(): Promise<boolean> {
  if (running) return true

  const sources = (await window.senti?.screenSources?.()) ?? []
  if (!sources.length) return false

  try {
    // Electron lets us capture a specific desktop source with no picker dialog.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // @ts-expect-error — Chromium desktop-capture constraints aren't in the DOM types
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sources[0].id,
          maxWidth: 1920,
          maxHeight: 1080,
        },
      },
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
  emit()
  // Tell the backend the feed went cold so the viewer stops waiting.
  try {
    await api(SCREEN_PATH, { method: 'DELETE' })
  } catch {
    // ignore — it'll go stale on its own
  }
}
