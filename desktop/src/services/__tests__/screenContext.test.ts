import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PERMISSIONS, useSettingsStore } from '../../state/settingsStore'
import { useScreenContextStore } from '../../state/screenContextStore'
import { backoffDelay, startScreenContext, stopScreenContext, WATCH_INTERVAL_MS } from '../screenContext'

const apiMock = vi.hoisted(() => vi.fn())
const contextStillMock = vi.hoisted(() => vi.fn())
const setContextCaptureMock = vi.hoisted(() => vi.fn())

vi.mock('../api', () => ({ api: apiMock }))
vi.mock('../screenShare', () => ({
  contextStill: contextStillMock,
  setContextCapture: setContextCaptureMock,
}))

describe('screenContext — opt-in background screen watcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('window', globalThis)
    useSettingsStore.setState({ permissions: { ...DEFAULT_PERMISSIONS } })
    useScreenContextStore.getState().reset()
    contextStillMock.mockResolvedValue('data:image/jpeg;base64,' + 'A'.repeat(500))
    apiMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        context: {
          summary: 'Editing TypeScript in VS Code',
          apps: ['VS Code'],
          activity: 'coding',
          label: 'Coding in VS Code',
        },
      },
    })
  })

  afterEach(() => {
    stopScreenContext()
    useSettingsStore.setState({ permissions: { ...DEFAULT_PERMISSIONS } })
    useScreenContextStore.getState().reset()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('defaults watchScreen to false and does not capture or poll until opted in', async () => {
    expect(DEFAULT_PERMISSIONS.watchScreen).toBe(false)
    expect(DEFAULT_PERMISSIONS.seeScreen).toBe(true)

    startScreenContext()
    expect(setContextCaptureMock).toHaveBeenCalledWith(false)
    expect(useScreenContextStore.getState().watching).toBe(false)

    await vi.advanceTimersByTimeAsync(15_000)
    expect(contextStillMock).not.toHaveBeenCalled()
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('starts watching when watchScreen is toggled on, parses { context }, and clears on toggle off', async () => {
    startScreenContext()
    useSettingsStore.getState().setPermissions({ watchScreen: true, seeScreen: true })

    expect(setContextCaptureMock).toHaveBeenLastCalledWith(true)
    expect(useScreenContextStore.getState().watching).toBe(true)

    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS)
    expect(contextStillMock).toHaveBeenCalledTimes(1)
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(useScreenContextStore.getState().current).toMatchObject({
      summary: 'Editing TypeScript in VS Code',
      apps: ['VS Code'],
      activity: 'coding',
      label: 'Coding in VS Code',
    })

    // Turning watchScreen off immediately disables capture and wipes cached screen context.
    useSettingsStore.getState().setPermissions({ watchScreen: false })
    expect(setContextCaptureMock).toHaveBeenLastCalledWith(false)
    expect(useScreenContextStore.getState().watching).toBe(false)
    expect(useScreenContextStore.getState().current).toBeNull()

    await vi.advanceTimersByTimeAsync(15_000)
    expect(contextStillMock).toHaveBeenCalledTimes(1)
  })

  it('never double-arms timers across repeated start calls or stop/restart mid-request', async () => {
    useSettingsStore.getState().setPermissions({ watchScreen: true, seeScreen: true })

    let resolveInFlight!: (v: unknown) => void
    apiMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInFlight = resolve
        })
    )

    startScreenContext()
    startScreenContext()
    startScreenContext()

    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS)
    expect(apiMock).toHaveBeenCalledTimes(1)

    // Stop and restart while the first generation's API request is still pending.
    stopScreenContext()
    contextStillMock.mockResolvedValue('data:image/jpeg;base64,' + 'B'.repeat(500))
    startScreenContext()

    // Completing the stale request must not push stale data or arm a second timer.
    resolveInFlight({
      ok: true,
      status: 200,
      data: { context: { summary: 'Stale frame', apps: [], activity: 'idle', label: 'Stale' } },
    })
    await Promise.resolve()
    expect(useScreenContextStore.getState().current).toBeNull()

    await vi.advanceTimersByTimeAsync(WATCH_INTERVAL_MS)
    expect(apiMock).toHaveBeenCalledTimes(2)
    expect(useScreenContextStore.getState().current?.summary).toBe('Editing TypeScript in VS Code')
  })

  it('backs off exponentially on transient errors without poisoning change detection, then recovers', async () => {
    expect(backoffDelay(0)).toBe(3000)
    expect(backoffDelay(1)).toBe(6000)
    expect(backoffDelay(2)).toBe(12000)
    expect(backoffDelay(5)).toBe(60000)

    useSettingsStore.getState().setPermissions({ watchScreen: true, seeScreen: true })
    apiMock
      .mockResolvedValueOnce({ ok: false, status: 503, data: { error: 'Vision busy' } })
      .mockRejectedValueOnce(new Error('network down'))

    startScreenContext()

    // 1st attempt at 3s fails with 503 -> backs off 6s (not 3s), and static screen still retries!
    await vi.advanceTimersByTimeAsync(3000)
    expect(apiMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(3000)
    expect(apiMock).toHaveBeenCalledTimes(1)

    // At +6s (t=9s), 2nd attempt rejects -> backs off 12s.
    await vi.advanceTimersByTimeAsync(3000)
    expect(apiMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(11_900)
    expect(apiMock).toHaveBeenCalledTimes(2)

    // At +12s (t=21s), 3rd attempt succeeds on the same frame and resets cadence to 3s.
    await vi.advanceTimersByTimeAsync(100)
    expect(apiMock).toHaveBeenCalledTimes(3)
    expect(useScreenContextStore.getState().current?.summary).toBe('Editing TypeScript in VS Code')
  })
})
