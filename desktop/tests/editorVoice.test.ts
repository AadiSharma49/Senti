import { afterEach, expect, it, vi } from 'vitest'
import { useWakeStore } from '../src/state/wakeStore'
import { DEFAULT_PERMISSIONS, useSettingsStore } from '../src/state/settingsStore'
import { reflect } from '../src/services/reflection'
import type { Utterance } from '../src/types/audio'

// Drive the same callback the real VAD recorder uses. Keep the wake parser,
// askSenti, permission gate, runAction, history, status and speech paths real.
const { transcribe, recording } = vi.hoisted(() => ({
  transcribe: vi.fn(), recording: { emit: (_u: Utterance) => {}, active: false },
}))
vi.mock('../src/services/speechRecognition', () => ({ loadSpeechRecognition: async () => {}, transcribeRaw: transcribe }))
vi.mock('../src/services/audioCapture', () => ({ audioCapture: { start() {}, stop() {}, subscribe: () => () => {} } }))
vi.mock('../src/services/utteranceRecorder', () => ({ UtteranceRecorder: class {
  onUtterance(fn: typeof recording.emit) { recording.emit = fn }
  start() { recording.active = true }
  stop() { recording.active = false }
} }))
const heard = async (text: string) => {
  transcribe.mockResolvedValueOnce(text)
  recording.emit({ duration: 1 } as Utterance)
  await vi.advanceTimersByTimeAsync(0)
}
class Utter {
  voice?: { localService: boolean }
  onend?: () => void
  constructor(public text: string) {}
}

afterEach(() => {
  useWakeStore.getState().stop()
  useSettingsStore.setState({ permissions: DEFAULT_PERMISSIONS })
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('voices and shows the actual local result; the next chat, status and reflection requests contain none of it', async () => {
  vi.useFakeTimers()
  const secret = 'unsaved editor text: PRIVATE_FIXTURE'
  const staleAudio = 'data:audio/wav;base64,stale'
  const next = [
    { text: 'I already read it.', audio: staleAudio, action: { name: 'get_active_file', args: {} } },
    { text: 'All tests passed.', audio: staleAudio, action: { name: 'run_tests', args: {} } },
    { text: 'Ready.', audio: null, action: null },
    { text: 'NONE', audio: null, action: null },
  ]
  const requests: { path: string; body: Record<string, unknown> }[] = []
  const api = async (r: typeof requests[number]) => {
    requests.push(structuredClone(r))
    const reply = r.path.endsWith('/chat') ? next.shift() : null
    return { ok: true, status: 200, data: reply ? { ...reply, reply: reply.text } : {} }
  }
  let finishTests!: () => void
  const codeBridgeRequest = vi.fn()
    .mockResolvedValueOnce({ ok: true, text: secret })
    .mockImplementationOnce(() => new Promise(resolve => { finishTests = () => resolve({ ok: false, text: 'Tests failed: 2 assertions.' }) }))
  const tts = vi.fn((u: Utter) => u.onend?.())
  const audio = vi.fn()
  vi.stubGlobal('Audio', audio)
  vi.stubGlobal('SpeechSynthesisUtterance', Utter)
  vi.stubGlobal('window', { senti: { api, codeBridgeRequest,
    activityList: async () => [{ process: 'Code', part: 'morning', minutes: 100, samples: [] }],
  }, setTimeout, speechSynthesis: {
    cancel() {}, speak: tts, getVoices: () => [
      { name: 'Online Guy Neural', lang: 'en-US', localService: false }, { name: 'Offline', lang: 'en-US', localService: true },
    ],
  } })
  useSettingsStore.setState({ permissions: { ...DEFAULT_PERMISSIONS, codeBridge: true } })
  await useWakeStore.getState().start()
  await heard('Read my active file')
  expect(codeBridgeRequest.mock.calls).toEqual([['get_active_file', {}]])
  expect(useWakeStore.getState()).toMatchObject({ state: 'speaking', detail: secret, editorResult: secret })
  expect(tts.mock.calls[0][0]).toMatchObject({ text: secret, voice: { localService: true } })
  expect(recording.active).toBe(false)
  await vi.advanceTimersByTimeAsync(2201)
  expect(recording.active).toBe(true)
  await heard('run my tests')
  expect(codeBridgeRequest).toHaveBeenLastCalledWith('run_tests', {})
  await vi.advanceTimersByTimeAsync(60_000) // approval may take longer than the idle timeout
  expect(useWakeStore.getState().talking).toBe(true)
  finishTests()
  await vi.advanceTimersByTimeAsync(0)
  expect(useWakeStore.getState().detail).toBe('Tests failed: 2 assertions.')
  expect(tts.mock.calls[1][0].text).toBe('Tests failed: 2 assertions.')
  await vi.advanceTimersByTimeAsync(2201)
  await heard('another question')
  // A later reflection receives the activity journal, never editor/HUD text.
  await reflect(true)
  const chats = requests.filter(r => r.path.endsWith('/chat'))
  expect(chats).toHaveLength(4)
  expect(chats.slice(0, 3).every(r => r.body.codeBridgeVersion === 1)).toBe(true)
  expect(chats[3].body.codeBridgeVersion).toBeUndefined()
  expect(chats[2].body.messages).toEqual([{ role: 'user', content: 'another question' }])
  expect(requests.some(r => r.path.endsWith('/status'))).toBe(true)
  expect(JSON.stringify(requests)).not.toContain('PRIVATE_FIXTURE')
  expect(audio).not.toHaveBeenCalled()
})

it('does not give private text to the default voice when no offline voice exists', async () => {
  vi.resetModules() // first-use voice selection, without the previous test's cached voices
  const { say } = await import('../src/services/greetingService')
  const tts = vi.fn((u: Utter) => u.onend?.())
  vi.stubGlobal('SpeechSynthesisUtterance', Utter)
  vi.stubGlobal('window', { speechSynthesis: { getVoices: () => [{ name: 'Cloud', lang: 'en-US', localService: false }], speak: tts, cancel() {} } })
  await say({ text: 'PRIVATE_FIXTURE', audio: null, localOnly: true }, 'en-US')
  expect(tts.mock.calls.map(([u]) => u.text)).toEqual(['The editor result is on screen. No offline voice is available.'])
})
