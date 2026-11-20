import type { QualityPreset } from './screenShare'

export interface RemoteEvent {
  t: 'move' | 'moverel' | 'click' | 'scroll' | 'type' | 'keydown' | 'keyup' | 'keyreset' | 'keysync' | 'quality'
  x?: number
  y?: number
  b?: 'left' | 'right' | 'middle'
  d?: number
  axis?: string
  text?: string
  k?: string
  code?: string
  mods?: string[]
  keys?: string[]
  preset?: QualityPreset
}

type Queued = RemoteEvent & { relayFence?: number }
type Packet = Queued & { seq: number }
type Direct = { send: (events: Packet[]) => boolean }
const POST_INTERVAL = 340
const MAX_BATCH = 64
const MAX_QUEUE_AGE = 1500

/** One instance per verified session. Nothing from an uncertain delivery is replayed. */
export class InputDelivery {
  private queue: Queued[] = []
  private relayFence = 0
  private queuedSince = 0
  private direct: Direct | null = null
  private generation = 0
  private seq = 0
  private flight = false
  private nextPost = 0
  private nextSync = 0
  private confirmRelease = false
  private keys = new Set<string>() // key edges already handed to this path
  private physical = new Set<string>() // viewer keys, including unsent edges
  private disarmed = false

  constructor(private post: (events: Packet[]) => Promise<boolean>, private now = () => performance.now()) {}

  setPath(direct: Direct | null, retiredGeneration = 0) {
    this.relayFence = Math.max(this.relayFence, retiredGeneration)
    if (this.direct === direct) return
    this.direct = direct
    this.reset()
    // Publish the new watermark even when the operator hasn't touched a key.
    void this.flush()
  }

  private stamp(e: RemoteEvent): Queued {
    // Stamp at capture, not POST time. Unsent actions must not acquire the
    // identity of a newer link merely because an offer retired before flush.
    return this.direct ? { ...e } : { ...e, relayFence: this.relayFence }
  }

  private reset() {
    this.generation++
    this.queue = [this.stamp({ t: 'keyreset' })]
    this.queuedSince = this.now()
    this.keys.clear()
    this.confirmRelease = false
    // If Ctrl/W was down at a discontinuity, require a fresh press. Do not
    // turn the next Ctrl+click into an unmodified click on the other path.
    this.disarmed = this.physical.size !== 0
  }

  enqueue(e: RemoteEvent) {
    if (e.t === 'keyreset') {
      this.physical.clear() // blur/hidden/lock change discarded the viewer's holds
      this.reset()
      return
    }
    if (this.queue.length >= 256 || (this.queue.length && this.now() - this.queuedSince > MAX_QUEUE_AGE)) this.reset()
    const key = e.code || e.k
    if (key && e.t === 'keydown') this.physical.add(key)
    if (key && e.t === 'keyup') this.physical.delete(key)
    if (this.disarmed) {
      this.disarmed = this.physical.size !== 0
      return
    }
    if (!this.queue.length) this.queuedSince = this.now()
    // Only adjacent motions can coalesce: moving across a click changes its meaning.
    const last = this.queue[this.queue.length - 1]
    const next = this.stamp(e)
    if (e.t === 'move' && last?.t === 'move') this.queue[this.queue.length - 1] = next
    else if (e.t === 'moverel' && last?.t === 'moverel' && last.relayFence === next.relayFence) {
      last.x = (last.x ?? 0) + (e.x ?? 0)
      last.y = (last.y ?? 0) + (e.y ?? 0)
    } else this.queue.push(next)
  }

  async flush() {
    const now = this.now()
    if (!this.direct && (this.flight || now < this.nextPost)) return
    if (this.queue.length && now - this.queuedSince > MAX_QUEUE_AGE) this.reset()
    const renewal = (this.keys.size > 0 || this.confirmRelease) && now >= this.nextSync
    if (!this.queue.length && !renewal) return

    // The GET that drains a successful POST can itself be lost. Begin every
    // HTTP batch with the releases the host needs *before* applying new input.
    // Snapshots never synthesize missing keydowns (no phantom typing/clicks).
    const events: Queued[] = []
    if ((!this.direct || renewal) && this.queue[0]?.t !== 'keyreset') {
      events.push(this.stamp({ t: 'keysync', keys: [...this.keys] }))
    }
    events.push(...this.queue.splice(0, MAX_BATCH - events.length))
    const packet = events.map(e => ({ ...e, seq: ++this.seq }))
    for (const e of events) {
      const key = e.code || e.k
      if (e.t === 'keysync' && !e.keys?.length) this.confirmRelease = false
      if (key && e.t === 'keydown') this.keys.add(key)
      if (key && e.t === 'keyup' && this.keys.delete(key) && !this.direct && !this.keys.size) {
        // If the final destructive GET disappeared, send ONE empty snapshot
        // even while idle. No clicks/typing or other edges are repeated.
        this.confirmRelease = true
      }
    }
    if (events.some(e => e.t === 'keysync') || !this.nextSync) this.nextSync = now + 800

    if (this.direct) {
      // A send failure does not prove the host has switched back to polling.
      // Discard ambiguous actions. Retry only a reset until readiness changes.
      try { if (this.direct.send(packet)) return } catch { /* closed mid-send */ }
      this.reset()
      return
    }
    this.flight = true
    this.nextPost = now + POST_INTERVAL
    const generation = this.generation
    try {
      if (!(await this.post(packet)) && generation === this.generation) this.reset()
    } catch {
      if (generation === this.generation) this.reset()
    } finally {
      this.flight = false
    }
  }
}
