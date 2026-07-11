import { useDeviceStore } from '../state/deviceStore'

/**
 * assistantService — sends the running conversation to Senti's brain
 * (dashboard /api/device/chat, powered by Google Gemini) and gets back a
 * spoken reply. The user's speech is transcribed on-device first; only text
 * leaves the machine. No API keys live on the desktop.
 */
const CHAT_URL = 'http://localhost:3000/api/device/chat'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface Reply {
  text: string
  /** data: URI of human-voice audio (ElevenLabs), or null → browser TTS. */
  audio: string | null
}

export async function askSenti(messages: ChatTurn[], lang: string): Promise<Reply> {
  const token = useDeviceStore.getState().token
  if (!token) {
    return {
      text: 'Link this device to your Senti account first — open Settings and paste your device token. Then I can talk with you.',
      audio: null,
    }
  }
  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, language: lang }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const text =
        res.status === 503
          ? 'My assistant service is not running. Start the Senti dashboard and try again.'
          : res.status === 401
          ? 'This device is not linked to an account, so I cannot answer yet.'
          : 'I could not reach my brain just now. Give me a moment and try again.'
      return { text, audio: null }
    }
    const data = await res.json()
    const text =
      typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : 'Sorry, I did not catch that.'
    const audio =
      typeof data.audio === 'string' && data.audio.startsWith('data:audio') ? data.audio : null
    return { text, audio }
  } catch {
    return {
      text: 'I could not reach my brain — make sure the Senti dashboard is running on this machine.',
      audio: null,
    }
  }
}
