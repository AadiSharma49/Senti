import { askSenti, type ChatTurn } from './assistantService'
import { getSystemSnapshot, describeSystem } from './systemInfo'
import { say, deviceLang } from './greetingService'
import { useWakeStore } from '../state/wakeStore'
import { useSettingsStore } from '../state/settingsStore'
import { reflect } from './reflection'

/**
 * Senti speaking first.
 *
 * Everything so far has been you talking and Senti answering. This is the
 * other half: it notices what you're doing — the game you launched, the video
 * you're watching, the file you've had open for three hours — and occasionally
 * says something unprompted, the way a friend in the room would.
 *
 * The entire design problem here is NOT being annoying. An assistant that
 * pipes up every few minutes gets muted on day one, so restraint is built in
 * at four levels:
 *
 *   - a long cooldown between anything it says unprompted,
 *   - it only speaks when something actually CHANGED, or you've been at one
 *     thing long enough to be worth a word,
 *   - never while you're mid-conversation with it, and
 *   - never twice about the same thing.
 *
 * What it knows is the foreground window's TITLE — which is how it can say
 * "still on that video?" without reading your screen. Screen content is never
 * captured or sent; the title is what Windows already shows in the taskbar.
 */
const CHECK_MS = 30_000
/** Never speak unprompted more often than this. */
const COOLDOWN_MS = 12 * 60_000
/** How long on one thing before it's worth remarking on. */
const DWELL_MS = 25 * 60_000
/** Nothing at all for this long after startup — let the user settle in. */
const WARMUP_MS = 3 * 60_000

interface Focus {
  title: string
  process: string
  since: number
}

let timer: number | null = null
let running = false
let busy = false
let startedAt = 0
let lastSpokeAt = 0
let current: Focus | null = null
/** Things already remarked on, so it never repeats itself. */
const mentioned = new Set<string>()

/** Windows that are noise, not activity. */
function isBoring(f: { title: string; process: string }): boolean {
  const p = f.process.toLowerCase()
  const t = f.title.trim().toLowerCase()
  if (!t) return true
  if (p === 'senti' || p === 'electron') return true // talking about itself
  return ['explorer', 'shellexperiencehost', 'searchhost', 'applicationframehost', 'textinputhost'].includes(p)
}

/** A stable key for "the same thing", so we don't repeat ourselves. */
function keyOf(f: Focus): string {
  return `${f.process}::${f.title}`.toLowerCase()
}

async function tick(): Promise<void> {
  if (busy || !running) return
  busy = true
  try {
    const now = Date.now()
    if (now - startedAt < WARMUP_MS) return

    // Reflect on the journal now and then — this is Senti forming its own
    // sense of you rather than waiting to be told things.
    void reflect().catch(() => {})

    const win = await window.senti?.activeWindow?.()
    if (!win || isBoring(win)) return

    // Every tick you stay put is time spent on that app; fold it in.
    if (current && current.title === win.title && current.process === win.process) {
      void window.senti?.activityRecord?.(win.process, win.title, CHECK_MS / 60_000)
    }

    // Track how long this window has held focus.
    if (!current || current.title !== win.title || current.process !== win.process) {
      current = { title: win.title, process: win.process, since: now }
      // A brand-new window is a candidate to remark on immediately; a long
      // dwell is handled below. Fall through either way.
    }

    if (now - lastSpokeAt < COOLDOWN_MS) return
    // Don't talk over an actual conversation.
    const state = useWakeStore.getState().state
    if (state !== 'listening' && state !== 'off') return
    if (useWakeStore.getState().talking) return

    const key = keyOf(current)
    if (mentioned.has(key)) return

    const dwell = now - current.since
    // Either you just switched to something interesting, or you've been on one
    // thing a long while. Anything in between isn't worth interrupting for.
    const worthIt = dwell < CHECK_MS * 2 || dwell > DWELL_MS
    if (!worthIt) return

    mentioned.add(key)
    if (mentioned.size > 200) mentioned.clear()
    lastSpokeAt = now
    await speakAbout(current, dwell)
  } catch {
    // Never let an unprompted remark break anything.
  } finally {
    busy = false
  }
}

async function speakAbout(focus: Focus, dwellMs: number): Promise<void> {
  const lang = deviceLang()
  const snap = await getSystemSnapshot()
  const minutes = Math.round(dwellMs / 60_000)

  const prompt =
    `[This is you speaking FIRST — the user didn't ask you anything. They're currently in ` +
    `"${focus.title}" (${focus.process})${minutes >= 5 ? `, for about ${minutes} minutes` : ', just switched to it'}. ` +
    `Say ONE short, natural line to them about it — a comment, a bit of banter, or a genuinely useful ` +
    `nudge if something's worth flagging. Talk like a friend in the room. Keep it to one sentence, ` +
    `and don't ask what they need — just say the thing.]`

  const turns: ChatTurn[] = [{ role: 'user', content: prompt }]
  const reply = await askSenti(turns, lang, snap ? describeSystem(snap) : null)
  // Unprompted means unprompted: never let it trigger an action.
  const text = reply.text?.trim()
  if (!text) return

  useWakeStore.setState({ state: 'speaking', detail: text })
  try {
    void window.senti?.hudShow?.()
  } catch {
    // no bridge outside Electron
  }
  await say({ text, audio: reply.audio }, lang)
  useWakeStore.setState({ state: 'listening', detail: '' })
  window.setTimeout(() => {
    if (useWakeStore.getState().state === 'listening') void window.senti?.hudHide?.()
  }, 1200)
}

export function startProactive(): void {
  if (running) return
  if (!useSettingsStore.getState().permissions.proactive) return
  running = true
  startedAt = Date.now()
  lastSpokeAt = 0
  current = null
  mentioned.clear()
  timer = window.setInterval(() => void tick(), CHECK_MS)
}

export function stopProactive(): void {
  running = false
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  current = null
}
