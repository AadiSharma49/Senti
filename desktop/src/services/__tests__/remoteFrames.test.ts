import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as share from '../screenShare'
import { startScreenContext, stopScreenContext } from '../screenContext'
import { DEFAULT_PERMISSIONS, useSettingsStore } from '../../state/settingsStore'

const request = vi.hoisted(() => vi.fn())
vi.mock('../api', () => ({ api: request }))
const stop = vi.fn()
const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toDataURL: vi.fn(() => 'data:image/jpeg;base64,frame') }
const stream = { getVideoTracks: () => [{ addEventListener: vi.fn(), applyConstraints: vi.fn(async () => {}) }], getTracks: () => [{ stop }] }
const display = vi.fn(async () => stream)
const posts = () => request.mock.calls.filter(([url, opts]) => url.endsWith('/screen') && opts?.method === 'POST')

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  request.mockResolvedValue({ ok: true })
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: display } })
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? canvas : {
    videoWidth: 1920, videoHeight: 1080, play: async () => {},
  } })
})
afterEach(async () => {
  stopScreenContext()
  await share.stopScreenShare()
  useSettingsStore.setState({ permissions: { ...DEFAULT_PERMISSIONS } })
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('remote video capture and JPEG fallback pacing', () => {
  it('shares one acquisition, samples 5 fps only on fallback, resumes after RTC drops', async () => {
    share.setFastFrames(true)
    await Promise.all([share.startScreenShare(), share.getScreenStream()])
    expect(display).toHaveBeenCalledTimes(1)
    expect(display).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ frameRate: { ideal: 30, max: 30 } }) }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(posts()).toHaveLength(5)
    expect(canvas.width).toBe(1280)
    share.pauseFrameUpload(true)
    await vi.advanceTimersByTimeAsync(8000)
    expect(canvas.toDataURL).toHaveBeenCalledTimes(5) // no wasted encode, not just no HTTP
    share.pauseFrameUpload(false)
    await vi.advanceTimersByTimeAsync(400)
    expect(posts()).toHaveLength(7)
    share.releaseRemoteScreen()
    await vi.advanceTimersByTimeAsync(1000)
    expect(posts()).toHaveLength(8) // separately requested manual share survives
    expect(stop).not.toHaveBeenCalled()
  })

  it('drops samples instead of queuing requests when an upload takes >200ms', async () => {
    let landed!: () => void
    request.mockImplementationOnce(() => new Promise(resolve => { landed = () => resolve({ ok: true }) }))
    share.setFastFrames(true)
    await share.getScreenStream()
    await vi.advanceTimersByTimeAsync(2000)
    expect(posts()).toHaveLength(1)
    landed()
    await vi.advanceTimersByTimeAsync(200)
    expect(posts()).toHaveLength(2)
    share.releaseRemoteScreen()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('a late display permission result cannot revive a stopped capture', async () => {
    let grant!: () => void
    display.mockImplementationOnce(() => new Promise(resolve => { grant = () => resolve(stream) }))
    const pending = share.getScreenStream()
    share.releaseRemoteScreen()
    grant()
    expect(await pending).toBeNull()
    expect(stop).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(2000)
    expect(posts()).toHaveLength(0)
  })

  it('an unchanged screen has one vision timer and does not compete with a remote session', async () => {
    useSettingsStore.getState().setPermissions({ watchScreen: true, seeScreen: true })
    startScreenContext()
    await vi.advanceTimersByTimeAsync(18_000)
    expect(canvas.toDataURL).toHaveBeenCalledTimes(6)
    expect(posts()).toHaveLength(0)
    await share.getScreenStream()
    share.pauseFrameUpload(true)
    await vi.advanceTimersByTimeAsync(18_000)
    expect(canvas.toDataURL).toHaveBeenCalledTimes(6)
    expect(display).toHaveBeenCalledTimes(1)
    share.releaseRemoteScreen()
    stopScreenContext()
    expect(stop).toHaveBeenCalledOnce()
  })
})
