import type { RemoteEvent } from '../../services/inputDelivery'

/** A physical press owns its release, even if Shift, layout, or focus changes. */
export function viewerKeyboard(send: (e: RemoteEvent) => void, close: () => void, locked: () => boolean) {
  // null = text tap (including native text auto-repeat), never a held VK.
  const pressed = new Map<string, RemoteEvent | null>()
  const down = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!locked() && !e.repeat) close()
      return // let Chromium handle pointer-lock escape
    }
    e.preventDefault()
    e.stopPropagation()
    const id = e.code || e.key
    if (pressed.has(id) && pressed.get(id) !== null) return
    const printable = Array.from(e.key).length === 1
    if (!locked() && printable && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.repeat && !pressed.has(id)) return // focus/lock changed during this press
      pressed.set(id, null)
      send({ t: 'type', text: e.key })
      return
    }
    if (pressed.has(id) || e.repeat) return
    // Use physical positions for games; keep k for older receivers. Explicit
    // modifier edges mean a Ctrl release need not wait for the chord keyup.
    const press: RemoteEvent = { t: 'keydown', k: e.key, code: e.code }
    pressed.set(id, press)
    send(press)
  }
  const up = (e: KeyboardEvent) => {
    const id = e.code || e.key
    if (!pressed.has(id)) return
    e.preventDefault()
    e.stopPropagation()
    const press = pressed.get(id)
    pressed.delete(id)
    if (press) send({ ...press, t: 'keyup' })
  }
  const reset = () => {
    pressed.clear()
    send({ t: 'keyreset' })
  }
  return { down, up, reset }
}
