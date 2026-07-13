import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { llmChat, type ChatMsg } from '@/lib/llm'
import { generateSpeech } from '@/lib/tts'

/**
 * Conversational assistant endpoint — Senti's Jarvis.
 *
 * The desktop transcribes the user's spoken question on-device (Whisper), then
 * POSTs the running conversation here. We answer with the configured LLM, then
 * voice the reply with ElevenLabs. Keys stay server-side; the desktop only ever
 * sends text and receives the reply plus audio.
 *
 * Called from the desktop's Electron MAIN process, never a browser — so there
 * is no CORS here by design (see lib/deviceAuth.ts). This is also the most
 * expensive route we have, so it is the most tightly rate limited.
 */
export const runtime = 'nodejs'

function persona(name: string | null, language: string): string {
  const who = name
    ? `Your owner's name is ${name}. Use their first name occasionally and naturally, not in every line.`
    : ''
  return (
    'You are Senti — a personal AI assistant living on your owner\'s computer, in the spirit of Jarvis from ' +
    'Iron Man: calm, sharp, warm, quietly confident, and genuinely useful. You speak with your owner out loud, ' +
    'so your answers are SPOKEN. ' +
    who +
    ' Talk like a smart friend, NOT a butler. Never say "sir", "madam", "master", or any other honorific — it ' +
    'sounds servile and fake. No "How may I assist you", no "Certainly", no corporate filler. ' +
    'Keep replies conversational and concise — usually 1 to 3 sentences, as if talking, not writing an ' +
    'essay. Get to the point; no bullet lists, no markdown, no headings, no emoji. When you genuinely do not ' +
    'know something current, say so plainly instead of inventing it. If asked to do ' +
    'something you cannot do on the machine yet (open apps, control the system), say what you would do and note ' +
    "it's coming. " +
    `Default spoken language for this session: BCP-47 "${language}". Always reply in the language the user speaks to you in.`
  )
}

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'chat')
  if (!auth.ok) return auth.response
  const { device } = auth

  let body: { messages?: ChatMsg[]; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })
  }

  // Keep only the last ~12 turns to bound the prompt, and drop empties. Also
  // cap each turn: an unbounded message is a way to burn tokens on our bill.
  const messages: ChatMsg[] = (body.messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && (m.content || '').trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
  if (!messages.length || messages[messages.length - 1].role !== 'user')
    return NextResponse.json({ error: 'No question' }, { status: 400, headers: NO_STORE })

  const user = await prisma.user.findUnique({ where: { id: device.userId } })
  const name = user?.name || user?.email?.split('@')[0] || null
  const language = (body.language || 'en-US').slice(0, 20)

  const reply =
    (await llmChat({
      system: persona(name, language),
      messages,
      search: true,
      maxTokens: 400,
      temperature: 0.85,
    })) || "I'm having trouble reaching my brain right now — check the assistant connection and try again."

  const audio = await generateSpeech(reply)

  return NextResponse.json({ reply, audio }, { headers: NO_STORE })
}
