import { api } from './api'

/**
 * Cross-device clipboard: copy on the PC, paste on the laptop.
 *
 * Every couple of seconds this reads the local clipboard; if YOU copied
 * something new, it uploads it. Same tick, it pulls the account's shared
 * clipboard; if another of your devices copied something newer, it lands on
 * this machine's clipboard, ready to paste.
 *
 * The echo problem is the whole subtlety here: applying a remote copy changes
 * the local clipboard, which must NOT then be re-uploaded as if you copied it
 * (two machines would ping-pong forever). `lastApplied` remembers what came
 * from remote so the watcher can tell "the user copied" from "we synced".
 *
 * Text only, latest copy only, synced between YOUR devices through your
 * account. Anything you copy while this is on leaves the machine — that's the
 * feature — so it sits behind its own permission toggle.
 */
const CLIPBOARD_PATH = '/api/device/clipboard'
const SYNC_MS = 2000

let timer: number | null = null
let busy = false
/** First tick only observes — see below. */
let seeded = false
/** The last text we saw on the local clipboard (whoever put it there). */
let lastLocal = ''
/** The last text we wrote INTO the local clipboard from a remote copy. */
let lastApplied = ''
/** The last remote timestamp we applied, so old rows are never re-applied. */
let lastStamp = ''

async function tick(): Promise<void> {
  if (busy) return
  busy = true
  try {
    const senti = window.senti
    if (!senti?.clipboardRead) return

    // First tick: SEED, don't sync. Whatever is sitting on this clipboard was
    // copied before Senti started — uploading it now would stomp a newer copy
    // from another device with stale text. Only copies made from here on count.
    if (!seeded) {
      seeded = true
      lastLocal = (await senti.clipboardRead()) ?? ''
      const first = await api<{ text?: string | null; mine?: boolean; updatedAt?: string }>(CLIPBOARD_PATH)
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
    if (local && local !== lastLocal) {
      lastLocal = local
      if (local !== lastApplied) {
        await api(CLIPBOARD_PATH, { method: 'POST', body: { text: local } })
      }
    }

    // 2. Did another device copy something newer? Land it here.
    const res = await api<{ text?: string | null; mine?: boolean; updatedAt?: string }>(CLIPBOARD_PATH)
    if (!res.ok) return
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
  if (timer !== null) return
  void tick()
  timer = window.setInterval(() => void tick(), SYNC_MS)
}

export function stopClipboardSync(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  // Next start must re-seed — the world moved while we were off.
  seeded = false
}
