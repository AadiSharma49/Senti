import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api'
import { endSession, onRemoteSessionEnded, startSession, verifyPin } from '../remoteControl'

vi.mock('../api', () => ({ api: vi.fn() }))
vi.mock('../peers', () => ({ peerScreen: vi.fn() }))
vi.mock('../webrtc', () => ({ startViewerPeer: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', globalThis)
})
afterEach(async () => {
  await endSession()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.resetAllMocks()
})

it.each([403, 404])('emits a confirmed remote hang-up (%i) once; 503 does not stop input', async status => {
  const beat = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue({ ok: false, status })
  vi.mocked(api).mockImplementation(async (_path, opts) => {
    const action = (opts?.body as { action: string }).action
    if (action === 'heartbeat') return beat()
    return { ok: true, status: 200, data: { ok: true, id: 's1' } }
  })
  const ended = vi.fn(), unsub = onRemoteSessionEnded(ended)
  try {
    await startSession('host'); await verifyPin('pin')
    await vi.advanceTimersByTimeAsync(6000); expect(ended).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(6000); expect(ended).toHaveBeenCalledWith('s1')
    await vi.advanceTimersByTimeAsync(6000); expect(beat).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  } finally { unsub() }
})

it('ignores a stale heartbeat 404 after another viewer session starts', async () => {
  let id = 'old', finish!: (r: { ok: boolean; status: number }) => void
  vi.mocked(api).mockImplementation(async (_path, opts) => {
    const action = (opts?.body as { action: string }).action
    if (action === 'heartbeat') return new Promise(resolve => { finish = r => resolve({ ...r, data: null }) })
    return { ok: true, status: 200, data: { ok: true, id } } as never
  })
  const ended = vi.fn(), unsub = onRemoteSessionEnded(ended)
  try {
    await startSession('host'); await verifyPin('pin')
    await vi.advanceTimersByTimeAsync(6000); await endSession()
    id = 'new'; await startSession('host'); await verifyPin('pin')
    finish({ ok: false, status: 404 }); await vi.advanceTimersByTimeAsync(1)
    expect(ended).not.toHaveBeenCalled()
  } finally { unsub() }
})
