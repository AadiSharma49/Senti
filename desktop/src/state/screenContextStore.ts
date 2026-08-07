import { create } from 'zustand'

/**
 * screenContextStore — the live model of what is on screen right now.
 *
 * Updated by a background capture loop (every ~3s) that sends the screen to
 * the vision API. The result is a structured summary, not a raw image — so
 * the rest of the app never touches pixels directly.
 *
 * The store is the single source of truth for "what is the user doing" — used
 * by the wake pipeline, the assistant, and any proactive nudges.
 */

export interface ScreenContext {
  /** ISO timestamp of this observation. */
  ts: number
  /** What the vision model saw — apps, windows, activity, content. */
  summary: string
  /** Apps the model detected, most recent first. */
  apps: string[]
  /** Current activity category the model inferred. */
  activity: 'coding' | 'gaming' | 'browsing' | 'watching' | 'reading' | 'writing' | 'working' | 'idle' | 'unknown'
  /** Short label for the HUD: "Coding in VS Code" / "Playing Valorant" etc. */
  label: string
  /** Whether this observation is fresh enough to trust. */
  fresh: boolean
  /** Raw structured data from the vision model, if available. */
  detail?: Record<string, unknown>
}

export interface ScreenContextStore {
  /** Rolling window of recent observations (most recent last). */
  history: ScreenContext[]
  /** The single latest observation. */
  current: ScreenContext | null
  /** Whether the background watcher is running. */
  watching: boolean
  /** Set when a new observation just arrived — consumed by wake pipeline. */
  justUpdated: boolean

  startWatching: () => void
  stopWatching: () => void
  /** Push a new observation; keeps history bounded. */
  pushContext: (ctx: ScreenContext) => void
  /** Clear everything — on sign-out or session end. */
  reset: () => void
}

const MAX_HISTORY = 40

export const useScreenContextStore = create<ScreenContextStore>((set, get) => ({
  history: [],
  current: null,
  watching: false,
  justUpdated: false,

  startWatching: () => set({ watching: true }),

  stopWatching: () => set({ watching: false }),

  pushContext: (ctx: ScreenContext) => {
    const history = [...get().history, ctx].slice(-MAX_HISTORY)
    set({ current: ctx, history, justUpdated: true })
    // Consume the flag on the next read; wake pipeline checks it.
    setTimeout(() => set({ justUpdated: false }), 0)
  },

  reset: () => set({ history: [], current: null, watching: false, justUpdated: false }),
}))
