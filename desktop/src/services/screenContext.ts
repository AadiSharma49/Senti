import { api } from './api'
import { contextStill, setContextCapture } from './screenShare'
import { useSettingsStore } from '../state/settingsStore'
import { useScreenContextStore, type ScreenContext } from '../state/screenContextStore'

const VISION_CONTEXT_PATH = '/api/device/vision'

/**
 * Opt-in background screen context interval.
 *
 * Disabled by default (`permissions.watchScreen === false`). When the user
 * explicitly enables it in Settings alongside `seeScreen`, Sentinel samples a
 * downscaled still every 3 seconds while the screen is changing and shows the
 * red capture badge the entire time.
 */
export const WATCH_INTERVAL_MS = 3000

const MIN_CHANGE_RATIO = 0.03
const MAX_ERRORS_BEFORE_PAUSE = 5
const MAX_BACKOFF_MS = 60_000

let timer: number | null = null
let running = false
let lastDataUrl: string | null = null
let generation = 0
let unsubscribe: (() => void) | undefined
let consecutiveErrors = 0

interface VisionContextPayload {
  summary?: string
  apps?: string[]
  activity?: string
  label?: string
}

interface VisionContextResponse extends VisionContextPayload {
  context?: VisionContextPayload
}

function isAllowed(): boolean {
  const { permissions } = useSettingsStore.getState()
  return permissions.watchScreen === true && permissions.seeScreen === true
}

function clearScheduledTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

export function backoffDelay(errors: number): number {
  if (errors <= 0) return WATCH_INTERVAL_MS
  if (errors >= MAX_ERRORS_BEFORE_PAUSE) return MAX_BACKOFF_MS
  return Math.min(MAX_BACKOFF_MS, WATCH_INTERVAL_MS * 2 ** errors)
}

/**
 * Start the opt-in background screen watcher. Safe to call multiple times —
 * at most one timer is ever armed across start/stop/permission transitions.
 */
export function startScreenContext(): void {
  if (running) return
  running = true
  consecutiveErrors = 0
  lastDataUrl = null
  const gen = ++generation

  let enabled = isAllowed()
  setContextCapture(enabled)
  if (enabled) {
    useScreenContextStore.getState().startWatching()
    schedule(gen, WATCH_INTERVAL_MS)
  } else {
    useScreenContextStore.getState().reset()
  }

  unsubscribe = useSettingsStore.subscribe(() => {
    const nextAllowed = isAllowed()
    if (enabled === nextAllowed) return
    enabled = nextAllowed
    setContextCapture(enabled)
    if (enabled) {
      consecutiveErrors = 0
      lastDataUrl = null
      useScreenContextStore.getState().startWatching()
      schedule(gen, WATCH_INTERVAL_MS)
    } else {
      clearScheduledTimer()
      lastDataUrl = null
      useScreenContextStore.getState().reset()
    }
  })
}

export function stopScreenContext(): void {
  running = false
  generation++
  clearScheduledTimer()
  lastDataUrl = null
  consecutiveErrors = 0
  unsubscribe?.()
  unsubscribe = undefined
  setContextCapture(false)
  useScreenContextStore.getState().reset()
}

function schedule(gen: number, delay: number): void {
  if (gen !== generation || !running || !isAllowed()) return
  clearScheduledTimer()
  timer = window.setTimeout(() => {
    timer = null
    void observe(gen)
  }, delay)
}

async function observe(gen: number): Promise<void> {
  if (gen !== generation || !running || !isAllowed()) return
  let next = WATCH_INTERVAL_MS
  try {
    const dataUrl = await contextStill()
    if (gen !== generation || !running || !isAllowed()) return
    if (!dataUrl || !isChangedEnough(dataUrl, lastDataUrl)) return

    const question =
      'Describe what is on this screen. Return a concise summary (1-2 sentences) ' +
      'of what the user is doing, which apps are visible, and what is happening. ' +
      'Also identify the primary app or activity.'

    const res = await api<VisionContextResponse>(VISION_CONTEXT_PATH, {
      method: 'POST',
      body: { image: dataUrl, question, language: 'en-US', context: true },
    })

    if (gen !== generation || !running || !isAllowed()) return
    if (res.ok) {
      lastDataUrl = dataUrl
      consecutiveErrors = 0
      const payload = res.data?.context ?? res.data
      if (payload?.summary) {
        const ctx: ScreenContext = {
          ts: Date.now(),
          summary: String(payload.summary).slice(0, 500),
          apps: Array.isArray(payload.apps) ? payload.apps.slice(0, 8).map(String) : [],
          activity: normalizeActivity(payload.activity),
          label: String(payload.label || payload.summary).slice(0, 80),
          fresh: true,
        }
        useScreenContextStore.getState().pushContext(ctx)
      }
    } else {
      consecutiveErrors++
      next = backoffDelay(consecutiveErrors)
    }
  } catch {
    consecutiveErrors++
    next = backoffDelay(consecutiveErrors)
  } finally {
    schedule(gen, next)
  }
}

/**
 * Stride-sampled base64 diff across the full JPEG data URL so changes anywhere
 * on the screen (not just the JPEG header or top rows) are caught in O(1) time.
 */
function isChangedEnough(a: string | null, b: string | null): boolean {
  if (!a || !b) return true
  if (a === b) return false
  if (Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1) >= MIN_CHANGE_RATIO) {
    return true
  }

  const len = Math.min(a.length, b.length)
  const samples = Math.min(len, 2000)
  const step = Math.max(1, Math.floor(len / samples))
  let diff = 0
  let checked = 0
  for (let i = 0; i < len; i += step) {
    checked++
    if (a.charCodeAt(i) !== b.charCodeAt(i)) diff++
  }
  return checked > 0 && diff / checked >= MIN_CHANGE_RATIO
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
    idle: 'idle', 'desktop empty': 'idle', nothing: 'idle',
  }
  return map[s] || 'unknown'
}
