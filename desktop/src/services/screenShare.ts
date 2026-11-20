import { api } from './api'

const SCREEN_PATH = '/api/device/screen'
const FRAME_INTERVAL_MS = 1000
const FAST_FRAME_MS = 200
const MAX_CONSECUTIVE_FAILURES = 8

export type QualityPreset = 'smooth' | 'balanced' | 'sharp'
export const QUALITY: Record<QualityPreset, { width: number; height: number; fps: number; bitrate: number; label: string }> = {
  smooth: { width: 1280, height: 720, fps: 60, bitrate: 8_000_000, label: '720p60 — smoothest' },
  balanced: { width: 1920, height: 1080, fps: 30, bitrate: 8_000_000, label: '1080p30 — balanced' },
  sharp: { width: 1920, height: 1080, fps: 60, bitrate: 12_000_000, label: '1080p60 — sharpest' },
}
let quality: QualityPreset = 'balanced'
export function getQuality(): QualityPreset { return quality }

function constraints(preset: QualityPreset): MediaTrackConstraints {
  const q = QUALITY[preset]
  return { width: { ideal: q.width, max: q.width }, height: { ideal: q.height, max: q.height }, frameRate: { ideal: q.fps, max: q.fps } }
}
export async function setQuality(next: QualityPreset): Promise<void> {
  quality = next
  for (const track of capture?.stream.getVideoTracks() ?? []) {
    await track.applyConstraints(constraints(next)).catch(() => { /* keep negotiated settings */ })
  }
}

// One physical capture. The explicit share, verified control session and vision
// sampler have different lifetimes. In particular, asking for a vision still
// must not start a 5fps JPEG upload alongside the real-time stream.
type Capture = { stream: MediaStream; video: HTMLVideoElement; canvas: HTMLCanvasElement }
let capture: Capture | null = null
let opening: Promise<Capture | null> | null = null
let generation = 0
let manual = false
let remote = false
let context = false
let fast = false
let paused = false
let timer: number | null = null
let inFlight = false
let failures = 0
const listeners = new Set<(on: boolean) => void>()
const captureListeners = new Set<(on: boolean) => void>()

/** A share usable by a remote viewer (not just an assistant vision sample). */
export function onScreenShareChange(cb: (on: boolean) => void): () => void {
  listeners.add(cb)
  cb(!!capture && (manual || remote))
  return () => listeners.delete(cb)
}
/** The local stop indicator must remain visible for *any* capture. */
export function onScreenCaptureChange(cb: (on: boolean) => void): () => void {
  captureListeners.add(cb)
  cb(!!capture)
  return () => captureListeners.delete(cb)
}
function emit(): void {
  for (const cb of listeners) cb(!!capture && (manual || remote))
  for (const cb of captureListeners) cb(!!capture)
}

async function open(gen: number): Promise<Capture | null> {
  const video = constraints(quality)
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: true })
  } catch {
    if (gen !== generation) return null
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: false }) } catch { return null }
  }
  if (gen !== generation || !stream.getVideoTracks().length) {
    stream.getTracks().forEach(t => t.stop())
    return null
  }
  const track = stream.getVideoTracks()[0]
  track.contentHint = 'motion'
  const el = document.createElement('video')
  el.muted = true
  el.srcObject = stream
  void el.play().catch(() => {})
  capture = { video: el, stream, canvas: document.createElement('canvas') }
  track.addEventListener('ended', () => {
    // Respect OS/user stop. Never reopen a lost display behind their back.
    if (gen === generation) void stopScreenShare()
  }, { once: true })
  void window.senti?.keepAwake?.(true, 'screenShare')
  emit()
  return capture
}
function acquire(): Promise<Capture | null> {
  if (capture) return Promise.resolve(capture)
  if (!opening) {
    const gen = generation
    opening = open(gen).finally(() => { if (generation === gen) opening = null })
  }
  return opening
}

/** Downscale only a still that is actually needed; WebRTC uses the track itself. */
function jpeg(c: Capture): string | null {
  const { video, canvas } = c
  if (!video.videoWidth || !video.videoHeight) return null
  const w = Math.min(1280, video.videoWidth)
  const h = Math.round(video.videoHeight * w / video.videoWidth)
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.5)
}
async function upload(): Promise<void> {
  const c = capture
  if (!c || paused || inFlight || !(manual || remote)) return
  const data = jpeg(c)
  if (!data) return
  inFlight = true
  let ok = false
  try { ok = (await api(SCREEN_PATH, { method: 'POST', body: { data, sharing: true } })).ok }
  finally {
    inFlight = false
    if (c === capture && !paused) {
      failures = ok ? 0 : failures + 1
      if (failures >= MAX_CONSECUTIVE_FAILURES && !remote) void stopScreenShare()
    }
  }
}
function scheduleUploads(): void {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  if (!capture || paused || !(manual || remote)) return
  // Drop a sample rather than build an encode/network backlog on a slow link.
  timer = window.setInterval(() => void upload().catch(() => {}), fast ? FAST_FRAME_MS : FRAME_INTERVAL_MS)
}
export function pauseFrameUpload(value: boolean): void {
  if (paused === value) return
  paused = value
  scheduleUploads()
}
export function setFastFrames(value: boolean): void {
  if (fast === value) return
  fast = value
  scheduleUploads()
}
export async function startScreenShare(): Promise<boolean> {
  manual = true
  const gen = generation
  const c = await acquire()
  if (gen !== generation) return false
  if (!c) manual = false
  emit()
  scheduleUploads()
  return !!c && manual
}
/** Remote host only. Independent of a manual share that may already be running. */
export async function getScreenStream(): Promise<MediaStream | null> {
  remote = true
  const gen = generation
  const c = await acquire()
  if (gen !== generation) return null
  if (!c) remote = false
  emit()
  scheduleUploads()
  return remote ? c?.stream ?? null : null
}
export function releaseRemoteScreen(): void {
  if (!manual && !context) {
    void stopScreenShare()
    return
  }
  const wasSharing = remote
  remote = fast = paused = false
  emit()
  scheduleUploads()
  if (wasSharing && !manual) void markCold()
}

export function setContextCapture(on: boolean): void {
  context = on
  if (!on && !remote && !manual) void stopScreenShare()
}
export async function contextStill(): Promise<string | null> {
  // Don't spend CPU on a second JPEG encoder or uplink on vision while driving.
  if (!context || remote) return null
  const c = await acquire()
  return c && context && !remote ? jpeg(c) : null
}
async function markCold(): Promise<void> {
  try { await api(SCREEN_PATH, { method: 'DELETE' }) } catch { /* expires server-side */ }
}
export async function stopScreenShare(): Promise<void> {
  const wasSharing = manual || remote || timer !== null
  generation++ // cancel a pending getDisplayMedia, including after stop/start
  opening = null
  manual = remote = context = fast = paused = false
  failures = 0
  scheduleUploads()
  if (capture) {
    const old = capture
    capture = null
    old.stream.getTracks().forEach(t => t.stop())
    old.video.srcObject = null
    void window.senti?.keepAwake?.(false, 'screenShare')
    emit()
  }
  if (wasSharing) await markCold()
}
