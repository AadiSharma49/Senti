// No Electron or OS APIs here. The writer targets exactly one injector's FIFO.
const VK: Record<string, number> = {
  Backspace: 8, Tab: 9, Enter: 13, Escape: 27, Space: 32, ' ': 32,
  PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  Insert: 45, Delete: 46, PrintScreen: 44, Pause: 19, NumLock: 144, CapsLock: 20, ScrollLock: 145,
  Shift: 16, ShiftLeft: 16, ShiftRight: 16, Control: 17, ControlLeft: 17, ControlRight: 17,
  Alt: 18, AltLeft: 18, AltRight: 18, Meta: 91, MetaLeft: 91, MetaRight: 92, ContextMenu: 93,
  NumpadMultiply: 106, NumpadAdd: 107, NumpadEnter: 13, NumpadSubtract: 109, NumpadDecimal: 110, NumpadDivide: 111,
  Semicolon: 186, Equal: 187, Comma: 188, Minus: 189, Period: 190, Slash: 191, Backquote: 192,
  BracketLeft: 219, Backslash: 220, BracketRight: 221, Quote: 222,
}
const mods = new Map([['shift', 16], ['ctrl', 17], ['alt', 18], ['meta', 91]])
const isMod = (vk: number) => vk === 16 || vk === 17 || vk === 18 || vk === 91 || vk === 92
function decode(name: unknown): number | undefined {
  if (typeof name !== 'string') return
  if (Object.prototype.hasOwnProperty.call(VK, name)) return VK[name]
  if (/^Key[A-Z]$/.test(name)) return name.charCodeAt(3)
  if (/^Digit\d$/.test(name)) return name.charCodeAt(5)
  if (/^[a-zA-Z0-9]$/.test(name)) return name.toUpperCase().charCodeAt(0)
  if (/^Numpad\d$/.test(name)) return 96 + Number(name.slice(6))
  if (/^F([1-9]|1\d|2[0-4])$/.test(name)) return 111 + Number(name.slice(1))
}
export interface InputEvent {
  t: string
  k?: string
  code?: string
  mods?: string[]
  keys?: string[]
  seq?: number
}

/** One watermark for *all* actions on both paths. Keep it through blur/peer loss. */
export class InputOrder {
  private last = 0
  accept(e: InputEvent) {
    if (e.seq === undefined) return true // old desktop/mobile clients
    if (!Number.isSafeInteger(e.seq) || e.seq <= this.last) return false
    this.last = e.seq
    return true
  }
}

type Press = { vk: number; borrowed: number[]; lease?: ReturnType<typeof setTimeout> }
export class RemoteKeyboard {
  private held = new Map<string, Press>()
  private down = new Set<number>()
  // A release-only snapshot may tell us a keydown never arrived. In that
  // case don't turn Ctrl+click into a plain click; wait for its release.
  private missing = new Set<string>()
  private repeats = new Map<number, ReturnType<typeof setTimeout>>()
  constructor(private write: (line: string) => void) {}

  private line(edge: 'D' | 'U', vk: number) { this.write(`${edge} 0x${vk.toString(16)}`) }
  private press(vk: number) {
    if (this.down.has(vk)) return
    this.down.add(vk)
    this.line('D', vk)
    if (!isMod(vk)) {
      const repeat = () => {
        if (!this.down.has(vk)) return
        this.repeats.set(vk, setTimeout(repeat, 32))
        this.line('D', vk)
      }
      this.repeats.set(vk, setTimeout(repeat, 400))
    }
  }
  private releaseUnused() {
    const wanted = new Set<number>()
    for (const { vk, borrowed } of this.held.values()) {
      wanted.add(vk)
      borrowed.forEach(mod => wanted.add(mod))
    }
    for (const vk of [...this.down].reverse()) {
      if (wanted.has(vk)) continue
      clearTimeout(this.repeats.get(vk))
      this.repeats.delete(vk)
      this.down.delete(vk)
      this.line('U', vk)
    }
  }
  private remove(id: string) {
    clearTimeout(this.held.get(id)?.lease)
    this.held.delete(id)
    this.releaseUnused()
  }
  private renew(id: string, press: Press, legacy = false) {
    clearTimeout(press.lease)
    // No snapshot/keyup (lost last HTTP GET, crashed viewer, sleeping host):
    // fail released. Older viewers don't send leases; allow longer holds.
    press.lease = setTimeout(() => this.remove(id), legacy ? 30_000 : 3000)
  }
  reset() {
    for (const press of this.held.values()) clearTimeout(press.lease)
    this.held.clear()
    this.missing.clear()
    this.releaseUnused()
  }
  handle(e: InputEvent): boolean {
    if (e.t === 'keyreset') { this.reset(); return true }
    if (e.t === 'keysync') {
      const keys = new Set(Array.isArray(e.keys) ? e.keys : [])
      this.missing = new Set([...keys].filter(id => decode(id) !== undefined && !this.held.has(id)))
      for (const [id, press] of this.held) {
        if (keys.has(id)) this.renew(id, press)
        else this.remove(id)
      }
      return true
    }
    if (e.t !== 'keydown' && e.t !== 'keyup') return this.missing.size > 0
    const vk = decode(e.code) ?? decode(e.k)
    if (vk === undefined) return true
    // Legacy keyup can carry a different key case / modifier mask.
    const id = e.code || (e.seq === undefined ? String(vk) : e.k!)
    if (e.t === 'keyup') {
      // Legacy viewers may send Ctrl up before the letter in Ctrl+C. Stop
      // borrowing it even if another legacy press hasn't released its key yet.
      if (isMod(vk)) for (const press of this.held.values()) press.borrowed = press.borrowed.filter(mod => mod !== vk)
      this.missing.delete(id)
      this.remove(id)
      return true
    }
    if (this.missing.size) { this.missing.add(id); return true }
    if (this.held.has(id)) return true
    const borrowed = Array.isArray(e.mods)
      ? [...mods].filter(([name, mod]) => mod !== vk && e.mods!.includes(name)).map(([, mod]) => mod) : []
    const press = { vk, borrowed }
    this.held.set(id, press)
    borrowed.forEach(mod => this.press(mod))
    this.press(vk)
    this.renew(id, press, e.seq === undefined)
    return true
  }
}
