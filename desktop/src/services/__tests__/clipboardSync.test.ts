import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PERMISSIONS, loadPermissions, useSettingsStore } from '../../state/settingsStore'
import { startClipboardSync, stopClipboardSync, SYNC_MS } from '../clipboardSync'

const apiMock = vi.hoisted(() => vi.fn())
vi.mock('../api', () => ({ api: apiMock }))

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value))
    },
  }
}

describe('clipboardSync — opt-in default-off cross-device clipboard', () => {
  let clipboardRead: ReturnType<typeof vi.fn>
  let clipboardWrite: ReturnType<typeof vi.fn>
  let storage: Storage

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    storage = createMemoryStorage()
    clipboardRead = vi.fn().mockResolvedValue('super-secret-password')
    clipboardWrite = vi.fn().mockResolvedValue(true)

    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal(
      'window',
      Object.assign(Object.create(globalThis), {
        setInterval: globalThis.setInterval.bind(globalThis),
        clearInterval: globalThis.clearInterval.bind(globalThis),
        senti: {
          clipboardRead,
          clipboardWrite,
        },
      })
    )

    useSettingsStore.setState({ permissions: { ...DEFAULT_PERMISSIONS } })
    apiMock.mockResolvedValue({ ok: true, status: 200, data: { text: null } })
  })

  afterEach(() => {
    stopClipboardSync()
    useSettingsStore.setState({ permissions: { ...DEFAULT_PERMISSIONS } })
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('defaults clipboardSync to false and never reads or uploads until opted in', async () => {
    expect(DEFAULT_PERMISSIONS.clipboardSync).toBe(false)
    expect(loadPermissions().clipboardSync).toBe(false)

    startClipboardSync()
    await vi.advanceTimersByTimeAsync(SYNC_MS * 5)

    expect(clipboardRead).not.toHaveBeenCalled()
    expect(clipboardWrite).not.toHaveBeenCalled()
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('resets legacy pre-opt-in persisted clipboardSync:true to false on upgrade', () => {
    // Simulates an existing install that saved the entire permissions object
    // when toggling some unrelated setting while clipboardSync defaulted to true.
    storage.setItem('senti:permissions', JSON.stringify({ closeApps: true, clipboardSync: true }))

    const loaded = loadPermissions()
    expect(loaded.clipboardSync).toBe(false)
    expect(loaded.closeApps).toBe(true)

    const rewritten = JSON.parse(storage.getItem('senti:permissions') || '{}')
    expect(rewritten.clipboardSync).toBe(false)
  })

  it('persists deliberate opt-in across reloads and clears it when switched back off', () => {
    useSettingsStore.getState().setPermissions({ clipboardSync: true })
    expect(useSettingsStore.getState().permissions.clipboardSync).toBe(true)
    expect(loadPermissions().clipboardSync).toBe(true)

    // Toggling another unrelated setting preserves the deliberate opt-in.
    useSettingsStore.getState().setPermissions({ closeApps: true })
    expect(loadPermissions().clipboardSync).toBe(true)

    // Turning it back off clears opt-in so it stays off across reloads.
    useSettingsStore.getState().setPermissions({ clipboardSync: false })
    expect(loadPermissions().clipboardSync).toBe(false)
  })

  it('seeds without uploading existing clipboard text on opt-in, then syncs new copies both ways', async () => {
    useSettingsStore.getState().setPermissions({ clipboardSync: true })
    startClipboardSync()

    // First tick seeds existing clipboard ("super-secret-password") without POSTing it.
    await Promise.resolve()
    await Promise.resolve()
    expect(clipboardRead).toHaveBeenCalledTimes(1)
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(apiMock).toHaveBeenCalledWith('/api/device/clipboard')

    // User copies new text after opting in -> uploaded on next tick.
    clipboardRead.mockResolvedValue('hello from PC')
    apiMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: { ok: true } })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { text: 'hello from PC', mine: true, updatedAt: '2026-11-25T10:00:00Z' },
      })

    await vi.advanceTimersByTimeAsync(SYNC_MS)
    expect(apiMock).toHaveBeenCalledWith('/api/device/clipboard', {
      method: 'POST',
      body: { text: 'hello from PC' },
    })
    expect(clipboardWrite).not.toHaveBeenCalled()

    // Another device copies newer text -> applied locally and NOT echoed back.
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { text: 'from laptop', mine: false, updatedAt: '2026-11-25T10:00:05Z' },
    })
    await vi.advanceTimersByTimeAsync(SYNC_MS)
    expect(clipboardWrite).toHaveBeenCalledWith('from laptop')

    // Next tick sees 'from laptop' on local clipboard -> must NOT re-POST it.
    clipboardRead.mockResolvedValue('from laptop')
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { text: 'from laptop', mine: false, updatedAt: '2026-11-25T10:00:05Z' },
    })
    const postCallsBefore = apiMock.mock.calls.filter(([, opts]) => opts?.method === 'POST').length
    await vi.advanceTimersByTimeAsync(SYNC_MS)
    const postCallsAfter = apiMock.mock.calls.filter(([, opts]) => opts?.method === 'POST').length
    expect(postCallsAfter).toBe(postCallsBefore)
  })

  it('aborts an in-flight tick immediately when the user turns clipboardSync off', async () => {
    useSettingsStore.getState().setPermissions({ clipboardSync: true })
    startClipboardSync()
    await Promise.resolve()
    await Promise.resolve()

    let resolveRead!: (value: string) => void
    clipboardRead.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve
        })
    )

    // Advance to trigger the next tick (now awaiting clipboardRead).
    await vi.advanceTimersByTimeAsync(SYNC_MS)

    // User toggles clipboardSync OFF while clipboardRead is still pending.
    useSettingsStore.getState().setPermissions({ clipboardSync: false })
    resolveRead('password-copied-just-before-disable')
    await Promise.resolve()
    await Promise.resolve()

    const postCalls = apiMock.mock.calls.filter(([, opts]) => opts?.method === 'POST')
    expect(postCalls).toHaveLength(0)

    // Subsequent intervals do not read or poll.
    const readCountAfterDisable = clipboardRead.mock.calls.length
    await vi.advanceTimersByTimeAsync(SYNC_MS * 4)
    expect(clipboardRead.mock.calls.length).toBe(readCountAfterDisable)
  })
})
