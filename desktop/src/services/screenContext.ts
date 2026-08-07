import { api } from './api'
import { getScreenStream, setFastFrames } from './screenShare'
import { useScreenContextStore, type ScreenContext } from '../state/screenContextStore'

const VISION_CONTEXT_PATH = '/api/device/vision'

/**
 * How often to grab a frame and ask the vision model "what's on screen?".
 *
 * 3 seconds is a balance: fast enough to catch context changes (switching apps,
 * game events), slow enough that we don't burn through the vision API budget.
 * Games change fast, but the HUD/menu screens where you actually need help
 * change slowly — 3s catches those.
 */
const WATCH_INTERVAL_MS = 3000

/**
 * Don't bother asking the vision model when the screen hasn't changed at all
 * since the last observation. A pixel-level diff on the downscaled JPEG is
 * cheap and skits pointless API calls when you're staring at a static page.
 */
const MIN_CHANGE_RATIO = 0.03

let timer: number | null = null
let running = false
let lastDataUrl: string | null = null
let destroyed = false
let consecutiveErrors = 0
const MAX_ERRORS_BEFORE_PAUSE = 5
/** True when the watcher was stopped intentionally (dismissed) — don't auto-restart. */
let manuallyStopped = false

/**
 * Start the background watcher. Captures screen every WATCH_INTERVAL_MS and
 * pushes ScreenContext observations to the store.
 *
 * Safe to call multiple times — only one watcher runs at a time.
 */
export function startScreenContext(): void {
  if (running) return
  running = true
  destroyed = false
  manuallyStopped = false
  useScreenContextStore.getState().startWatching()
  setFastFrames(true)
  void tick()
}

export function stopScreenContext(): void {
  running = false
  destroyed = true
  manuallyStopped = true
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  lastDataUrl = null
  useScreenContextStore.getState().stopWatching()
  setFastFrames(false)
}

async function tick(): Promise<void> {
  if (destroyed || !running) return
  timer = window.setTimeout(() => void observe(), WATCH_INTERVAL_MS)
}

async function observe(): Promise<void> {
  if (destroyed || !running) return

  try {
    const stream = await getScreenStream()
    if (!stream) {
      // Capture failed — likely a display switch. Retry after a short delay.
      timer = window.setTimeout(() => void observe(), 1000)
      return
    }

    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play().catch(() => {})

    await new Promise<void>((resolve) => {
      const onMeta = () => resolve()
      video.addEventListener('loadedmetadata', onMeta, { once: true })
      setTimeout(resolve, 500)
    })

    if (video.videoWidth === 0) {
      void tick()
      return
    }

    const canvas = document.createElement('canvas')
    const MAX_W = 1280
    const scale = Math.min(1, MAX_W / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      void tick()
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.5)

    if (dataUrl === lastDataUrl || !isChangedEnough(dataUrl, lastDataUrl)) {
      void tick()
      return
    }
    lastDataUrl = dataUrl

    const question =
      'Describe what is on this screen. Return a concise summary (1-2 sentences) ' +
      'of what the user is doing, which apps are visible, and what is happening. ' +
      'Also identify the primary app or activity.'

    const res = await api<{ summary?: string; apps?: string[]; activity?: string; label?: string }>(
      VISION_CONTEXT_PATH,
      {
        method: 'POST',
        body: { image: dataUrl, question, language: 'en-US', context: true },
      }
    )

    if (res.ok && res.data?.summary) {
      const ctx: ScreenContext = {
        ts: Date.now(),
        summary: String(res.data.summary).slice(0, 500),
        apps: Array.isArray(res.data.apps) ? res.data.apps.slice(0, 8) : [],
        activity: normalizeActivity(res.data.activity),
        label: String(res.data.label || res.data.summary).slice(0, 80),
        fresh: true,
      }
      useScreenContextStore.getState().pushContext(ctx)

      // If a game is detected, pause the watcher to save CPU/GPU for the game.
      if (ctx.activity === 'gaming') {
        void stopScreenContext()
        // Resume after 30 seconds — the user might alt-tab out.
        // But only if they didn't manually stop the watcher.
        timer = window.setTimeout(() => {
          if (!manuallyStopped && !destroyed && running === false) {
            startScreenContext()
          }
        }, 30000)
        return
      }

      consecutiveErrors = 0
    } else if (res.status === 503) {
      // Vision API busy — back off and retry later.
      consecutiveErrors++
      if (consecutiveErrors >= MAX_ERRORS_BEFORE_PAUSE) {
        // Pause for a minute if vision is consistently busy.
        timer = window.setTimeout(() => void observe(), 60000)
        return
      }
    }
  } catch {
    // Silently skip failed observations — a transient API error shouldn't
    // stop the watcher. The next tick will try again.
    consecutiveErrors++
  } finally {
    if (running && !destroyed) {
      void tick()
    }
  }
}

/**
 * Quick-and-dirty change detection: compare the first N bytes of two JPEG
 * data URLs. If they match exactly, the screen is identical. If they differ
 * significantly, something changed. Not pixel-perfect, but good enough to
 * skip ~90% of static-screen API calls.
 */
function isChangedEnough(a: string | null, b: string | null): boolean {
  if (!a || !b) return true
  if (a === b) return false
  // Compare a 4KB sample from each — enough to detect changes cheaply.
  const sampleA = a.slice(0, 4000)
  const sampleB = b.slice(0, 4000)
  if (sampleA === sampleB) return false
  // They differ — estimate ratio of different bytes.
  let diff = 0
  const len = Math.min(sampleA.length, sampleB.length)
  for (let i = 0; i < len; i++) {
    if (sampleA[i] !== sampleB[i]) diff++
  }
  const ratio = diff / len
  return ratio >= MIN_CHANGE_RATIO
}

function normalizeActivity(raw: unknown): ScreenContext['activity'] {
  const s = String(raw || '').toLowerCase().trim()
  const map: Record<string, ScreenContext['activity']> = {
    coding: 'coding', programming: 'coding', 'writing code': 'coding', 'editing code': 'coding',
    gaming: 'gaming', playing: 'gaming', 'in game': 'gaming',
    browsing: 'browsing', surfing: 'browsing', 'reading web': 'browsing',
    watching: 'watching', 'watching video': 'watching', 'watching movie': 'watching',
    reading: 'reading', 'reading document': 'reading',
    writing: 'writing', 'writing email': 'writing', 'writing doc': 'writing',
    working: 'working', 'in meeting': 'working', 'on a call': 'working',
    idle: 'idle', 'desktop empty': 'idle', 'nothing': 'idle',
  }
  return map[s] || 'unknown'
}
