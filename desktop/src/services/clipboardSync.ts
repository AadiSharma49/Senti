import { api } from './api'
import { useSettingsStore } from '../state/settingsStore'

/**
 * Cross-device clipboard: copy on the PC, paste on the laptop.
 *
 * Opt-in (off by default: `permissions.clipboardSync === false`). Nothing is
 * read from the OS clipboard or uploaded until the user explicitly turns this
 * on in Settings.
 *
 * When enabled, every couple of seconds this reads the local clipboard; if YOU
 * copied something new, it uploads it. Same tick, it pulls the account's shared
 * clipboard; if another of your devices copied something newer, it lands on
 * this machine's clipboard, ready to paste.
 *
 * The echo problem is the whole subtlety here: applying a remote copy changes
 * the local clipboard, which must NOT then be re-uploaded as if you copied it
 * (two machines would ping-pong forever). `lastApplied` remembers what came
 * from remote so the watcher can tell "the user copied" from "we synced".
 *
 * Text only, latest copy only, synced between YOUR devices through your
 * account. Anything you copy while this is on leaves the machine — including
 * passwords — so it is strictly opt-in and stops immediately when turned off.
 */
const CLIPBOARD_PATH = '/api/device/clipboard'
export const SYNC_MS = 2000

let timer: number | null = null
let busy = false
let generation = 0
let unsubscribe: (() => void) | undefined
/** First tick only observes — see below. */
let seeded = false
/** The last text we saw on the local clipboard (whoever put it there). */
let lastLocal = ''
/** The last text we wrote INTO the local clipboard from a remote copy. */
let lastApplied = ''
/** The last remote timestamp we applied, so old rows are never re-applied. */
let lastStamp = ''

function isAllowed(): boolean {
  return useSettingsStore.getState().permissions.clipboardSync === true
}

function isActive(gen: number): boolean {
  return gen === generation && timer !== null && isAllowed()
}

async function tick(gen: number): Promise<void> {
  if (busy || !isActive(gen)) return
  busy = true
  try {
    const senti = window.senti
    if (!senti?.clipboardRead) return

    // First tick: SEED, don't sync. Whatever is sitting on this clipboard was
    // copied before Senti started — uploading it now would stomp a newer copy
    // from another device with stale text. Only copies made from here on count.
    if (!seeded) {
      const initialLocal = (await senti.clipboardRead()) ?? ''
      if (!isActive(gen)) return
      lastLocal = initialLocal
      const first = await api<{ text?: string | null; mine?: boolean; updatedAt?: string }>(CLIPBOARD_PATH)
      if (!isActive(gen)) return
      seeded = true
      if (first.ok && first.data?.updatedAt) {
        lastStamp = first.data.updatedAt
        // A fresh boot with an EMPTY clipboard may adopt the account's latest
        // copy — that's the "copy on the PC, walk to the laptop, paste" case.
        if (!lastLocal && first.data.text && !first.data.mine) {
          lastApplied = first.data.text
          lastLocal = first.data.text
          await senti.clipboardWrite?.(first.data.text)
        }
      }
      return
    }

    // 1. Did the user copy something new here? Push it up.
    const local = (await senti.clipboardRead()) ?? ''
    if (!isActive(gen)) return
    if (local && local !== lastLocal) {
      lastLocal = local
      if (local !== lastApplied) {
        await api(CLIPBOARD_PATH, { method: 'POST', body: { text: local } })
        if (!isActive(gen)) return
      }
    }

    // 2. Did another device copy something newer? Land it here.
    const res = await api<{ text?: string | null; mine?: boolean; updatedAt?: string }>(CLIPBOARD_PATH)
    if (!isActive(gen) || !res.ok) return
    const { text, mine, updatedAt } = res.data ?? {}
    if (!text || mine || !updatedAt || updatedAt === lastStamp) return
    lastStamp = updatedAt
    if (text === local) return // both machines already agree
    lastApplied = text
    lastLocal = text
    await senti.clipboardWrite?.(text)
  } catch {
    // Offline — next tick will try again.
  } finally {
    busy = false
  }
}

export function startClipboardSync(): void {
  if (!isAllowed()) {
    stopClipboardSync()
    return
  }
  if (timer !== null) return
  const gen = ++generation
  unsubscribe = useSettingsStore.subscribe(() => {
    if (!isAllowed()) stopClipboardSync()
  })
  timer = window.setInterval(() => void tick(gen), SYNC_MS)
  void tick(gen)
}

export function stopClipboardSync(): void {
  generation++
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  unsubscribe?.()
  unsubscribe = undefined
  // Next start must re-seed — and don't retain old clipboard text in memory.
  seeded = false
  lastLocal = ''
  lastApplied = ''
  lastStamp = ''
}
