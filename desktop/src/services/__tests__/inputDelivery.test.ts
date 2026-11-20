import { describe, expect, it, vi } from 'vitest'
import { InputDelivery, type RemoteEvent } from '../inputDelivery'
import { viewerKeyboard } from '../../components/remote/viewerKeyboard'
import { InputOrder } from '../../../electron/remoteKeyboard'

type Packet = (RemoteEvent & { seq: number })[]
function key(key: string, code: string, extra: Partial<KeyboardEvent> = {}) {
  return { key, code, preventDefault() {}, stopPropagation() {}, ...extra } as KeyboardEvent
}

describe('viewer physical vs text input', () => {
  it('allows text repeats but never a phantom text keyup; game WASD holds and releases once', () => {
    const sent: RemoteEvent[] = [], close = vi.fn()
    let game = false
    const k = viewerKeyboard(e => sent.push(e), close, () => game)
    k.down(key('é', 'KeyE')); k.down(key('é', 'KeyE', { repeat: true })); k.up(key('e', 'KeyE'))
    game = true
    k.down(key('W', 'KeyW', { shiftKey: true })); k.down(key('W', 'KeyW', { repeat: true })); k.up(key('w', 'KeyW'))
    k.down(key('Escape', 'Escape')); expect(close).not.toHaveBeenCalled()
    game = false
    k.down(key('Escape', 'Escape')); expect(close).toHaveBeenCalledOnce()
    expect(sent).toEqual([{ t: 'type', text: 'é' }, { t: 'type', text: 'é' },
      { t: 'keydown', k: 'W', code: 'KeyW' }, { t: 'keyup', k: 'W', code: 'KeyW' }])
  })
  it('captures Meta shortcuts; blur reset discards held identities and OS repeats', () => {
    const sent: RemoteEvent[] = []
    const k = viewerKeyboard(e => sent.push(e), () => {}, () => false)
    k.down(key('Meta', 'MetaLeft')); k.down(key('s', 'KeyS', { metaKey: true }))
    k.reset(); k.down(key('s', 'KeyS', { repeat: true })); k.up(key('s', 'KeyS'))
    expect(sent.map(e => e.t)).toEqual(['keydown', 'keydown', 'keyreset'])
  })
})

describe('ordered input delivery', () => {
  it('coalesces only adjacent positions; preceding movement does not cross clicks/keys', async () => {
    const sent: Packet[] = [], d = new InputDelivery(async p => { sent.push(p); return true })
    d.setPath({ send: p => { sent.push(p); return true } })
    d.enqueue({ t: 'move', x: 0 }); d.enqueue({ t: 'move', x: .2 }); d.enqueue({ t: 'click' })
    d.enqueue({ t: 'moverel', x: 2 }); d.enqueue({ t: 'moverel', x: -1 }); d.enqueue({ t: 'keydown', k: 'Tab' }); d.enqueue({ t: 'move', x: .7 })
    await d.flush()
    expect(sent.flat().map(e => [e.t, e.x])).toEqual([['keyreset', undefined], ['move', .2], ['click', undefined],
      ['moverel', 1], ['keydown', undefined], ['move', .7]])
  })
  it('single-flights fallback; bounds POST cadence and splits bursts across 64-event packets', async () => {
    let now = 0, finish!: (ok: boolean) => void
    const posts: Packet[] = [], d = new InputDelivery(p => { posts.push(p); return new Promise(r => { finish = r }) }, () => now)
    for (let i = 0; i < 90; i++) d.enqueue({ t: 'type', text: String(i) })
    const first = d.flush()
    now = 1000; await d.flush(); expect(posts).toHaveLength(1)
    finish(true); await first
    const second = d.flush(); finish(true); await second
    d.enqueue({ t: 'click' }); now += 339; await d.flush(); expect(posts).toHaveLength(2)
    now++; const third = d.flush(); finish(true); await third
    expect(posts.map(p => p.length)).toEqual([64, 28, 2])
    expect(posts.flat().filter(e => e.t === 'type').map(e => e.text)).toEqual(Array.from({ length: 90 }, (_, i) => String(i)))
  })
  it('does not replay ambiguous typing/clicks. Only a reset is retried, including on non-OK HTTP', async () => {
    let now = 0
    const sent: Packet[] = [], d = new InputDelivery(async p => { sent.push(p); return sent.length !== 1 }, () => now)
    d.enqueue({ t: 'type', text: 'x' }); d.enqueue({ t: 'click' }); d.enqueue({ t: 'keydown', code: 'ControlLeft' })
    await d.flush()
    // Ctrl was down across a discontinuity: this should NOT become a plain click.
    d.enqueue({ t: 'click' }); now += 340; await d.flush()
    d.enqueue({ t: 'keyup', code: 'ControlLeft' }); d.enqueue({ t: 'type', text: 'y' }); now += 340; await d.flush()
    expect(sent.map(p => p.map(e => e.t))).toEqual([['keysync', 'type', 'click', 'keydown'], ['keyreset'], ['keysync', 'type']])
  })
  it('fences in-flight HTTP through direct and back, without allowing stale callbacks to reset the new path', async () => {
    let now = 0, finish!: (ok: boolean) => void
    const relay: Packet[] = [], rtc: Packet[] = [], order = new InputOrder()
    const d = new InputDelivery(p => { relay.push(p); return new Promise(r => { finish = r }) }, () => now)
    d.enqueue({ t: 'click' }); const first = d.flush(); d.enqueue({ t: 'type', text: 'stale' })
    d.setPath({ send: p => { rtc.push(p); return true } }); d.enqueue({ t: 'keydown', code: 'KeyW' }); await d.flush()
    d.setPath(null); d.enqueue({ t: 'keyup', code: 'KeyW' }); d.enqueue({ t: 'type', text: 'fresh' })
    now += 340; await d.flush(); expect(relay).toHaveLength(1)
    finish(false); await first
    const final = d.flush(); finish(true); await final
    const applied = [...rtc.flat(), ...relay.flat()].filter(e => order.accept(e))
    expect(applied.map(e => e.t)).toEqual(['keyreset', 'keydown', 'keyreset', 'type'])
    expect(applied.at(-1)?.text).toBe('fresh')
  })
  it('never promotes a pre-RTC click to a fresh HTTP fence, even when the direct reset itself was lost', async () => {
    const relay: (Packet[number] & { relayFence?: number })[] = []
    const d = new InputDelivery(async p => { relay.push(...p); return true })
    d.enqueue({ t: 'click' })
    d.setPath(null, 3) // host saw ready but this viewer only observed the offer retire
    d.enqueue({ t: 'type', text: 'fresh' }); await d.flush()
    expect(relay.filter(e => e.t === 'click')[0].relayFence).toBe(0)
    expect(relay.filter(e => e.relayFence === 3).map(e => e.t)).toEqual(['keysync', 'type'])
  })

  it('sends one empty release confirmation when the last keyup was followed by silence', async () => {
    let now = 0
    const sent: Packet[] = [], d = new InputDelivery(async p => { sent.push(p); return true }, () => now)
    d.enqueue({ t: 'keydown', code: 'KeyW' }); await d.flush()
    now += 340; d.enqueue({ t: 'keyup', code: 'KeyW' }); await d.flush()
    now += 1000; await d.flush(); expect(sent.at(-1)?.map(e => [e.t, e.keys])).toEqual([['keysync', []]])
    now += 1000; await d.flush(); expect(sent).toHaveLength(3)
  })

  it('resolves a lost HTTP keyup before the next action, with periodic renewals only while held', async () => {
    let now = 0
    const posts: Packet[] = [], d = new InputDelivery(async p => { posts.push(p); return true }, () => now)
    d.enqueue({ t: 'keydown', code: 'AltLeft' }); await d.flush()
    now = 1000; await d.flush(); expect(posts.at(-1)?.[0].keys).toEqual(['AltLeft'])
    d.enqueue({ t: 'keyup', code: 'AltLeft' }); now += 340; await d.flush() // GET response lost
    d.enqueue({ t: 'type', text: 'x' }); now += 340; await d.flush()
    expect(posts.at(-1)?.map(e => [e.t, e.keys])).toEqual([['keysync', []], ['type', undefined]])
    now += 5000; await d.flush(); expect(posts).toHaveLength(4)
  })
})
