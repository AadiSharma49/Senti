import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../dashboard/app/api/device/chat/route'
import { runAction } from '../src/services/actions'
import { DEFAULT_PERMISSIONS, useSettingsStore } from '../src/state/settingsStore'

// Run the actual Next route and renderer dispatcher, replacing only their I/O.
const { model, speech } = vi.hoisted(() => ({ model: vi.fn(), speech: vi.fn() }))
vi.mock('next/server', () => ({ NextResponse: Response })) // desktop tests don't require a dashboard install
vi.mock('@/lib/deviceAuth', () => ({ authenticateDevice: async () => ({ ok: true, device: { id: 'pc', userId: 'u' } }), NO_STORE: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: async () => null }, device: { findMany: async () => [] } } }))
vi.mock('@/lib/llm', () => ({ llmChatRich: model }))
vi.mock('@/lib/tts', () => ({ generateSpeech: speech }))
vi.mock('@/lib/websearch', () => ({ webSearchEnabled: false }))
vi.mock('@/lib/editorChatTools', () => import('../../dashboard/lib/editorChatTools'))

const bridge = vi.fn(), osOpen = vi.fn()
const setEnabled = (on: boolean) => useSettingsStore.setState({ permissions: { ...DEFAULT_PERMISSIONS, codeBridge: on } })
const question = [{ role: 'user', content: 'A voice request' }]
async function chat(version: unknown = 1, messages = question) {
  return (await POST(new Request('http://localhost/api/device/chat', { method: 'POST', body: JSON.stringify({ codeBridgeVersion: version, messages }) }))).json()
}
const offeredNames = () => (model.mock.calls[0][0].tools as { function: { name: string } }[]).map(t => t.function.name)
function proposal(name: string, args: unknown) {
  model.mockResolvedValue({ text: 'Predicted success', toolCall: { name, args } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { senti: { codeBridgeRequest: bridge, openFile: osOpen } })
  setEnabled(false)
  bridge.mockResolvedValue({ ok: true, text: 'Actual editor result' })
})
afterEach(() => { vi.unstubAllGlobals(); setEnabled(false) })

describe('voice chat route → local action dispatcher', () => {
  const cases: [string, string, Record<string, unknown>][] = [
    ['read_file', 'read_file', { path: 'src/Main.ts' }],
    ['write_file', 'write_file', { path: 'src/Main.ts', text: '  const o = { a: 1 };\r\n' }],
    ['write_file', 'write_file', { path: 'empty.txt', text: '' }],
    ['list_files', 'list_files', {}], ['list_files', 'list_files', { path: 'src' }],
    ['run_tests', 'run_tests', {}], ['get_active_file', 'get_active_file', {}],
    ['get_diagnostics', 'get_diagnostics', {}], ['get_git_status', 'get_git_status', {}],
    ['open_editor_file', 'open_file', { path: 'src/Main.ts' }],
  ]
  it.each(cases)('%s reaches only its IPC command with validated arguments', async (name, wire, args) => {
    proposal(name, args)
    const { action, audio } = await chat()
    expect(audio).toBeNull()
    expect(speech).not.toHaveBeenCalled()
    expect(action).toEqual({ name, args })
    const offered = offeredNames()
    expect(offered).toContain(name)
    expect(offered).not.toContain('run_terminal')
    expect(DEFAULT_PERMISSIONS.codeBridge).toBe(false)
    expect(await runAction(action)).toMatch(/not allowed/i)
    setEnabled(true)
    expect(await runAction(action, 'remote')).toMatch(/not allowed/i)
    expect(bridge).not.toHaveBeenCalled()
    expect(await runAction(action, 'voice')).toBe('Actual editor result')
    expect(bridge.mock.calls).toEqual([[wire, args]])
    expect(osOpen).not.toHaveBeenCalled()
  })

  it.each([['Read my active file.', 'get_active_file'], ['Run my tests!', 'run_tests']])(
    'routes the exact utterance “%s” even without a tool-calling model', async (utterance, name) => {
      setEnabled(true)
      const response = await chat(1, [{ role: 'user', content: utterance }])
      expect(model).not.toHaveBeenCalled()
      expect(response.action).toEqual({ name, args: {} })
      expect(await runAction(response.action)).toBe('Actual editor result')
      expect(bridge).toHaveBeenCalledWith(name, {})
    })

  it('does not treat an incidental task mention as an explicit test request', async () => {
    model.mockResolvedValueOnce({ text: 'Understood.', toolCall: null })
    expect((await chat(1, [{ role: 'user', content: "Don't run my tests." }])).action).toBeNull()
    expect(bridge).not.toHaveBeenCalled()
  })

  it('still dispatches open_file to OS search without the editor permission', async () => {
    proposal('open_file', { query: 'resume' })
    osOpen.mockResolvedValue({ ok: true, label: 'Resume.pdf' })
    expect(await runAction((await chat()).action)).toBe('Opening Resume.pdf.')
    expect(osOpen).toHaveBeenCalledWith('resume')
    expect(bridge).not.toHaveBeenCalled()
  })

  it.each([null, 0, 2, '1'])('neither offers nor emits editor tools for version %j', async version => {
    proposal('read_file', { path: 'x' })
    expect((await chat(version)).action).toBeNull()
    const offered = offeredNames()
    expect(offered).not.toContain('read_file')
    expect(offered).toContain('open_file')
  })

  it.each([
    ['read_file', {}], ['read_file', { path: 123 }], ['read_file', { path: '../outside' }],
    ['open_editor_file', { path: 'C:\\Temp\\file' }], ['list_files', { path: '/home' }],
    ['get_diagnostics', { path: 'file' }], ['run_tests', { command: 'arbitrary' }], ['run_tests', null],
    ['get_active_file', []], ['write_file', { path: 'file', text: false }], ['write_file', { path: 'file' }],
    ['write_file', { path: 'p'.repeat(2049), text: '' }], ['write_file', { path: 'file', text: '\uD800' }], ['write_file', { path: 'file', text: 'あ'.repeat(22000) }],
  ] as [string, unknown][])('rejects malformed %s in both route and renderer', async (name, args) => {
    proposal(name, args)
    expect((await chat()).action).toBeNull()
    setEnabled(true)
    expect(await runAction({ name, args: args as Record<string, unknown> })).toMatch(/invalid/i)
    expect(bridge).not.toHaveBeenCalled()
  })

  it('does not send an editor proposal to a legacy client with no capability field', async () => {
    proposal('run_tests', {})
    const response = await POST(new Request('http://localhost/api/device/chat', { method: 'POST', body: JSON.stringify({ messages: question }) }))
    expect((await response.json()).action).toBeNull()
    expect(offeredNames()).not.toContain('run_tests')
  })

  it('does not turn model prose or clipped JSON into an editor task', async () => {
    model.mockResolvedValue({ text: '<function=run_tests{"command":', toolCall: null })
    expect(await chat()).toMatchObject({ action: null, audio: null })
  })

  it('rejects oversized user input rather than asking the model for a partial write', async () => {
    expect(await chat(1, [{ role: 'user', content: 'write file ' + 'x'.repeat(4000) }])).toMatchObject({ action: null, audio: null })
    expect(model).not.toHaveBeenCalled()
  })

  it('never dispatches a shell tool', async () => {
    proposal('run_terminal', { command: 'arbitrary' })
    expect((await chat()).action).toBeNull()
    setEnabled(true)
    expect(await runAction({ name: 'run_terminal', args: {} })).toMatch(/not allowed/i)
    expect(bridge).not.toHaveBeenCalled()
  })

  it('reports real refusals and transport errors instead of model success', async () => {
    proposal('run_tests', {})
    const { action } = await chat()
    setEnabled(true)
    bridge.mockResolvedValueOnce({ ok: false, text: 'Approval cancelled in VS Code.' }).mockRejectedValueOnce(new Error('IPC failed'))
    expect(await runAction(action)).toBe('Approval cancelled in VS Code.')
    expect(await runAction(action)).toMatch(/no response/i)
  })
})
