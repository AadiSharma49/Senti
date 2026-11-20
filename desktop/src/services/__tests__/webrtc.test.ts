import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startHostPeer, startViewerPeer } from '../webrtc'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('../api', () => ({ api }))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}
const video = () => Object.assign(new EventTarget(), { kind: 'video', readyState: 'live' })
const screen = { getVideoTracks: () => [video()], getAudioTracks: () => [] } as unknown as MediaStream
const msg = (generation: number, kind: string, data: unknown) => ({ kind, payload: JSON.stringify({ generation, data }) })
let inbox: ReturnType<typeof msg>[]
let outbox: { kind: string; generation: number }[]
let pcs: PC[]
let remoteGate: Promise<void> | undefined
let offerGate: Promise<void> | undefined
let senderGate: Promise<void> | undefined
class Channel {
  readyState = 'connecting'
  label = 'input'
  ordered = true
  onopen?: () => void
  onclose?: () => void
  close = vi.fn(() => { this.readyState = 'closed'; this.onclose?.() })
  open() { this.readyState = 'open'; this.onopen?.() }
}
class PC {
  connectionState = 'new'
  remoteDescription: unknown
  localDescription: unknown
  ch = new Channel()
  ontrack?: (e: { streams: unknown[]; track: ReturnType<typeof video> }) => void
  onconnectionstatechange?: () => void
  constructor() { pcs.push(this) }
  state(s: string) { this.connectionState = s; this.onconnectionstatechange?.() }
  addTransceiver() { return {} }
  createDataChannel = vi.fn(() => this.ch)
  sender = { getParameters: () => ({ encodings: [{}] }), setParameters: vi.fn(async (_params: unknown) => { await senderGate }) }
  addTrack = vi.fn(() => this.sender)
  createOffer = vi.fn(async () => { await offerGate; return { type: 'offer', sdp: 'O' } })
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'A' }))
  setLocalDescription = vi.fn(async desc => { this.localDescription = desc })
  setRemoteDescription = vi.fn(async desc => { await remoteGate; this.remoteDescription = desc })
  addIceCandidate = vi.fn(async () => { expect(this.remoteDescription).toBeDefined() })
  close = vi.fn(() => { this.connectionState = 'closed' })
  getStats = vi.fn(async () => new Map())
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('RTCPeerConnection', PC)
  pcs = []; inbox = []; outbox = []; remoteGate = offerGate = senderGate = undefined
  api.mockReset().mockImplementation(async (_path, opts) => {
    if (opts) {
      const { kind, payload } = opts.body
      outbox.push({ kind, generation: JSON.parse(payload).generation })
      return { ok: true }
    }
    return { ok: true, data: { signals: inbox.splice(0) } }
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('remote session signalling', () => {
  it('buffers pre-offer ICE, awaits SDP in the mailbox, and rejects retired generations', async () => {
    const gate = deferred(); remoteGate = gate.promise
    inbox.push(msg(2, 'ice', { candidate: 'early' }), msg(2, 'offer', { type: 'offer' }),
      msg(2, 'ice', { candidate: 'later' }), msg(1, 'offer', { type: 'offer' }), msg(1, 'ice', {}))
    const host = startHostPeer('id', screen, vi.fn(), vi.fn())
    await vi.advanceTimersByTimeAsync(1000)
    expect(pcs).toHaveLength(1)
    expect(pcs[0].setRemoteDescription).toHaveBeenCalledTimes(1)
    expect(pcs[0].addIceCandidate).not.toHaveBeenCalled()
    expect(api).toHaveBeenCalledTimes(1) // no second destructive GET during async SDP
    gate.resolve(); await vi.advanceTimersByTimeAsync(0)
    expect(pcs[0].addIceCandidate.mock.calls).toEqual([[{ candidate: 'early' }], [{ candidate: 'later' }]])
    expect(outbox).toEqual([{ kind: 'answer', generation: 2 }])
    inbox.push(msg(3, 'offer', { type: 'offer' }), msg(2, 'ice', { candidate: 'obsolete' }))
    await vi.advanceTimersByTimeAsync(500)
    expect(pcs).toHaveLength(2)
    expect(pcs[0].close).toHaveBeenCalledTimes(1)
    expect(pcs[1].addIceCandidate).not.toHaveBeenCalled()
    expect(host.retiredGeneration()).toBe(0) // a failed negotiation must not interrupt ordinary HTTP
    const second = pcs[1] as PC & { ondatachannel: (e: { channel: Channel }) => void }
    second.ondatachannel({ channel: second.ch }); second.ch.open(); second.state('connected')
    expect(host.connected()).toBe(true)
    second.state('disconnected')
    expect(host.retiredGeneration()).toBe(3)
    host.close(); expect(vi.getTimerCount()).toBe(0)
  })

  it('sets only negotiated sender ceilings, serializing and coalescing preset changes', async () => {
    const sdp = deferred(), params = deferred()
    remoteGate = sdp.promise; senderGate = params.promise
    inbox.push(msg(1, 'offer', { type: 'offer' }))
    const host = startHostPeer('id', screen, vi.fn(), vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    const pc = pcs[0]
    const set = pc.sender.setParameters
    host.setSenderQuality('smooth')
    expect(set).not.toHaveBeenCalled()
    sdp.resolve(); await vi.advanceTimersByTimeAsync(0)
    expect(set).toHaveBeenCalledTimes(1)
    host.setSenderQuality('sharp'); host.setSenderQuality('smooth')
    expect(set).toHaveBeenCalledTimes(1)
    params.resolve(); await vi.advanceTimersByTimeAsync(0)
    expect(set).toHaveBeenCalledTimes(2)
    expect(set).toHaveBeenLastCalledWith({
      encodings: [{ maxBitrate: 8_000_000, maxFramerate: 60 }], degradationPreference: 'maintain-framerate',
    })
    pc.state('connected'); await vi.advanceTimersByTimeAsync(9500)
    expect(pc.getStats).not.toHaveBeenCalled() // no competing RTT-driven rate controller
    expect(set).toHaveBeenCalledTimes(2)
    host.close()
  })

  it('reports readiness only with both transports and retries on a later channel loss', async () => {
    const state = vi.fn()
    const viewer = startViewerPeer('id', vi.fn(), state)
    const pc = pcs[0]
    await vi.advanceTimersByTimeAsync(0)
    const first = outbox[0].generation
    inbox.push(msg(first, 'ice', { candidate: 'early' }), msg(first, 'answer', { type: 'answer' }))
    await vi.advanceTimersByTimeAsync(500)
    expect(pc.addIceCandidate).toHaveBeenCalledWith({ candidate: 'early' })
    expect(pc.createDataChannel).toHaveBeenCalledWith('input', { ordered: true })
    pc.state('connected'); pc.ontrack?.({ streams: [{}], track: video() })
    expect(await viewer.stats()).toBeNull()
    expect(state).not.toHaveBeenCalled()
    pc.ch.open()
    expect(await viewer.firstAttempt).toBe(true)
    expect(await viewer.stats()).toBeInstanceOf(Map)
    pc.state('connecting'); pc.state('connected')
    expect(state.mock.calls).toEqual([[true]])
    pc.ch.close(); expect(pc.close).toHaveBeenCalledTimes(1)
    expect(viewer.retiredGeneration()).toBe(first)
    await vi.advanceTimersByTimeAsync(1200)
    const second = outbox[1].generation
    expect(second).toBeGreaterThan(first)
    inbox.push(msg(first, 'answer', { type: 'answer' }), msg(first, 'ice', {}), msg(second, 'answer', { type: 'answer' }))
    await vi.advanceTimersByTimeAsync(2200)
    const replacement = pcs[1]
    expect(replacement.addIceCandidate).not.toHaveBeenCalled()
    expect(replacement.setRemoteDescription).toHaveBeenCalledTimes(1)
    replacement.ch.open(); replacement.ontrack?.({ streams: [{}], track: video() }); replacement.state('connected')
    expect(state.mock.calls).toEqual([[true], [false], [true]])
    viewer.close(); expect(vi.getTimerCount()).toBe(0)
  })

  it('closing while an offer is pending cannot publish it or resurrect its poller', async () => {
    const gate = deferred(); offerGate = gate.promise
    const v = startViewerPeer('id', vi.fn(), vi.fn())
    v.close(); gate.resolve(); await vi.advanceTimersByTimeAsync(30_000)
    expect(await v.firstAttempt).toBe(false)
    expect(pcs).toHaveLength(1)
    expect(pcs[0].close).toHaveBeenCalledTimes(1)
    expect(outbox).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejecting a startup SDP POST closes its PC, and stopping cancels the retry', async () => {
    api.mockImplementation(async (_p, opts) => opts ? { ok: false } : { ok: true, data: { signals: [] } })
    const v = startViewerPeer('id', vi.fn(), vi.fn())
    expect(await v.firstAttempt).toBe(false)
    expect(v.retiredGeneration()).toBeGreaterThan(0) // peer may have seen readiness we didn't
    expect(pcs[0].close).toHaveBeenCalledTimes(1)
    v.close(); await vi.advanceTimersByTimeAsync(30_000)
    expect(pcs).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
