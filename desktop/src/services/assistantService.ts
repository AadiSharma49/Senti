import { api } from './api'
import { rankMemories } from './memoryRecall'

/**
 * assistantService — sends the running conversation to Senti's brain
 * (/api/device/chat) and gets back a spoken reply.
 *
 * The user's speech is transcribed on-device first, so only text leaves the
 * machine. The request itself is made by the Electron main process (see
 * services/api.ts), so the device token never touches renderer JavaScript.
 */
const CHAT_PATH = '/api/device/chat'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface Reply {
  text: string
  /** data: URI of human-voice audio (ElevenLabs), or null → browser TTS. */
  audio: string | null
  /** Something Senti should DO on this machine, if the model asked for it. */
  action: { name: string; args: Record<string, unknown> } | null
}

/**
 * The facts Senti keeps about you, narrowed to the ones that bear on what was
 * just said. Sending all of them buries the relevant ones once there are more
 * than a handful — see memoryRecall for how they're ranked.
 */
async function loadMemories(query: string): Promise<string[]> {
  try {
    const mems = await window.senti?.memoryList?.()
    if (!Array.isArray(mems)) return []
    return rankMemories(
      mems.filter((m) => m?.text),
      query
    )
  } catch {
    return []
  }
}

export async function askSenti(
  messages: ChatTurn[],
  lang: string,
  /** Plain-text vitals for this machine, so Senti can answer about it. */
  system?: string | null
): Promise<Reply> {
  // Rank against the newest user turn — that's what the reply must serve.
  const latest = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const memories = await loadMemories(latest)
  const res = await api<{
    reply?: string
    audio?: string
    action?: { name: string; args: Record<string, unknown> } | null
    error?: string
  }>(CHAT_PATH, {
    method: 'POST',
    body: { messages, language: lang, system: system || undefined, memories },
  })

  if (!res.ok) {
    const text =
      res.status === 401
        ? 'This device is not linked to an account yet. Open Settings and paste your pairing token.'
        : res.status === 429
        ? 'You are talking to me faster than I can keep up. Give me a moment.'
        : res.status === 503
        ? 'My assistant service is not running. Start the Senti dashboard and try again.'
        : 'I could not reach my brain just now. Give me a moment and try again.'
    return { text, audio: null, action: null }
  }

  const data = res.data || {}
  const text = typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : 'Sorry, I did not catch that.'
  const audio = typeof data.audio === 'string' && data.audio.startsWith('data:audio') ? data.audio : null
  const action = data.action && typeof data.action.name === 'string' ? data.action : null
  return { text, audio, action }
}
