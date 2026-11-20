import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteKeyboard, type InputEvent } from '../../../electron/remoteKeyboard'
import { endControlSession, startRemoteHost, stopRemoteHost } from '../remoteHost'

const m = vi.hoisted(() => ({
  api: vi.fn(), startPeer: vi.fn(), capture: vi.fn(), release: vi.fn(),
  pause: vi.fn(), fast: vi.fn(), observe: vi.fn(), close: vi.fn(),
  remoteInput: vi.fn(), resetRemoteKeyState: vi.fn(), remoteInputStop: vi.fn(), keepAwake: vi.fn(),
}))
vi.mock('../api', () => ({ api: m.api }))
vi.mock('../webrtc', () => ({ startHostPeer: m.startPeer }))
vi.mock('../screenShare', () => ({
  getScreenStream: m.capture, releaseRemoteScreen: m.release, onScreenShareChange: m.observe,
  setFastFrames: m.fast, pauseFrameUpload: m.pause, setQuality: vi.fn(), QUALITY: {},
}))
let id: string
let index = 0
const calls = (path: string) => m.api.mock.calls.filter(([url, opts]) => url.includes(path) && !opts)
beforeEach(() => {
  id = `session-${++index}`
  vi.clearAllMocks(); vi.useFakeTimers()
  vi.stubGlobal('window', { senti: m, setTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  m.capture.mockResolvedValue({}); m.remoteInput.mockResolvedValue(true)
  m.observe.mockImplementation(cb => { cb(false); return vi.fn() })
  m.startPeer.mockReturnValue({ close: m.close, retiredGeneration: () => 0 })
  m.api.mockImplementation(async (url, opts) => {
    if (!opts && url.endsWith('/session')) return { ok: true, data: { session: { id } } }
    return { ok: true, data: { events: [] } }
  })
})
afterEach(() => { stopRemoteHost(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('host session ownership', () => {
  it('stops HTTP input when ready, restores it on loss, and rechecks permission independently', async () => {
    startRemoteHost(); await vi.advanceTimersByTimeAsync(950)
    expect(calls('/input')).toHaveLength(4)
    expect(calls('/session')).toHaveLength(1)
    const [, , input, ready] = m.startPeer.mock.calls[0]
    ready(true)
    input([{ t: 'keydown', seq: 5 }]); expect(m.remoteInput).toHaveBeenCalledTimes(1)
    expect(m.pause).toHaveBeenLastCalledWith(true)
    await vi.advanceTimersByTimeAsync(2500)
    expect(calls('/input')).toHaveLength(4)
    expect(calls('/session')).toHaveLength(4)
    ready(false)
    expect(m.resetRemoteKeyState).toHaveBeenCalledTimes(2) // once at each switch
    expect(m.pause).toHaveBeenLastCalledWith(false)
    m.api.mockResolvedValueOnce({ ok: true, data: { events: [{ t: 'click', seq: 4 }, { t: 'keyup', seq: 6 }] } })
    await vi.advanceTimersByTimeAsync(305)
    expect(calls('/input')).toHaveLength(6)
    expect(m.remoteInput).toHaveBeenLastCalledWith([{ t: 'keyup', seq: 6 }])
    ready(true)
    m.api.mockResolvedValueOnce({ ok: false, status: 403 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(m.close).toHaveBeenCalledTimes(1)
    expect(m.release).toHaveBeenCalledTimes(1)
    input([{ t: 'click', seq: 7 }]); expect(m.remoteInput).toHaveBeenCalledTimes(2)
    expect(m.startPeer).toHaveBeenCalledTimes(1)
  })

  it('a 3.5s handshake does not create competing peers or starve a minute of session checks', async () => {
    // Same conditions as the frozen-host reproduction: 50ms per server call,
    // no packet loss. Count both routes even though deployed budgets are now separate.
    let reads = 0
    m.api.mockImplementation(async (url, opts) => {
      await new Promise(r => setTimeout(r, 50))
      if (!opts) reads++
      if (reads > 300) return { ok: false, status: 429 }
      return { ok: true, data: url.endsWith('/session') ? { session: { id } } : { events: [] } }
    })
    m.startPeer.mockImplementation((_id, _stream, _input, ready) => {
      setTimeout(() => ready(true), 3500)
      return { close: m.close, retiredGeneration: () => 0 }
    })
    startRemoteHost(); await vi.advanceTimersByTimeAsync(60_000)
    expect(m.startPeer).toHaveBeenCalledTimes(1)
    expect(m.close).not.toHaveBeenCalled()
    expect(reads).toBeLessThan(75)
    expect(calls('/input').length).toBeLessThan(12)
  })

  it('a busy session poll does not disconnect immediately or extend authorization', async () => {
    startRemoteHost(); await vi.advanceTimersByTimeAsync(20)
    m.startPeer.mock.calls[0][3](true)
    m.api.mockResolvedValue({ ok: false, status: 429 })
    await vi.advanceTimersByTimeAsync(2000)
    expect(m.close).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(4100)
    expect(m.close).toHaveBeenCalledOnce()
    expect(m.release).toHaveBeenCalledOnce()
  })

  it('does not inject a latent relay click even if the first direct packet was never received', async () => {
    let retired = 0
    m.startPeer.mockReturnValue({ close: m.close, retiredGeneration: () => retired })
    startRemoteHost(); await vi.advanceTimersByTimeAsync(1)
    const ready = m.startPeer.mock.calls[0][3]
    ready(true); retired = 3; ready(false)
    const fresh = { t: 'type', text: 'fresh', seq: 7, relayFence: 3 }
    m.api.mockResolvedValueOnce({ ok: true, data: { events: [{ t: 'click', seq: 6, relayFence: 2 }, fresh] } })
    await vi.advanceTimersByTimeAsync(1)
    expect(m.remoteInput).toHaveBeenCalledTimes(1)
    expect(m.remoteInput).toHaveBeenCalledWith([fresh])
  })

  it('stopping during capture invalidates a late acquisition and its queued work', async () => {
    let finish!: (screen: unknown) => void
    m.capture.mockImplementationOnce(() => new Promise(r => { finish = r }))
    startRemoteHost(); await vi.advanceTimersByTimeAsync(0)
    stopRemoteHost(); finish({}); await vi.advanceTimersByTimeAsync(10_000)
    expect(m.release).toHaveBeenCalledTimes(1)
    expect(m.startPeer).not.toHaveBeenCalled()
    expect(calls('/input')).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('local hang-up wins over a late input GET and the same session still advertised by the server', async () => {
    let respond!: (res: unknown) => void
    m.api.mockImplementation(async (url, opts) => url.includes('/input') ? new Promise(r => { respond = r }) :
      { ok: true, data: opts ? {} : { session: { id } } })
    startRemoteHost(); await vi.advanceTimersByTimeAsync(10)
    await endControlSession(); respond({ ok: true, data: { events: [{ t: 'click' }] } })
    await vi.advanceTimersByTimeAsync(5000)
    expect(m.remoteInput).not.toHaveBeenCalled()
    expect(m.startPeer).toHaveBeenCalledTimes(1)
    expect(m.capture).toHaveBeenCalledTimes(1)
  })

  it('releases Ctrl and a held letter at the injector boundary if the link dies before either keyup', async () => {
    const lines: string[] = []
    const keyboard = new RemoteKeyboard(line => lines.push(line))
    m.remoteInput.mockImplementation(async (events: InputEvent[]) => events.forEach(e => keyboard.handle(e)))
    m.resetRemoteKeyState.mockImplementation(() => keyboard.reset())
    startRemoteHost(); await vi.advanceTimersByTimeAsync(1)
    const [, , input, ready] = m.startPeer.mock.calls[0]
    ready(true)
    input([{ t: 'keydown', code: 'ControlLeft', seq: 1 }, { t: 'keydown', code: 'KeyW', seq: 2 }])
    expect(lines).toEqual(['D 0x11', 'D 0x57'])
    ready(false) // lose the connection with both keys physically down
    await vi.advanceTimersByTimeAsync(2000)
    expect(lines).toEqual(['D 0x11', 'D 0x57', 'U 0x57', 'U 0x11']) // no runaway repeat
  })

  it('ends the verified session on explicit capture stop rather than reacquiring', async () => {
    startRemoteHost(); await vi.advanceTimersByTimeAsync(1)
    const observe = m.observe.mock.calls[0][0]
    observe(true); observe(false)
    await vi.advanceTimersByTimeAsync(1200)
    expect(m.close).toHaveBeenCalledTimes(1)
    expect(m.api).toHaveBeenCalledWith('/api/device/remote/session', { method: 'POST', body: { action: 'end', id } })
    expect(m.capture).toHaveBeenCalledTimes(1)
  })
})
