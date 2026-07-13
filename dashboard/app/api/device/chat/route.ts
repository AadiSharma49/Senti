import { NextResponse } from 'next/server'
import { dbEnabled, prisma } from '@/lib/prisma'
import { getDeviceByToken } from '@/lib/db'
import { llmChat, type ChatMsg } from '@/lib/llm'
import { generateSpeech } from '@/lib/tts'

/**
 * Conversational assistant endpoint — Senti's Jarvis.
 *
 * The desktop transcribes the user's spoken question on-device (Whisper), then
 * POSTs the running conversation here. We answer with Google Gemini (with live
 * Google Search grounding so it knows current facts), then voice the reply with
 * ElevenLabs. Both keys stay server-side; the desktop only ever sends text and
 * receives the reply plus audio.
 */
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function bearer(req: Request): string | null {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

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
  if (!dbEnabled)
    return NextResponse.json({ error: 'Accounts not configured' }, { status: 503, headers: CORS })
  const token = bearer(req)
  if (!token)
    return NextResponse.json({ error: 'Missing device token' }, { status: 401, headers: CORS })
  const device = await getDeviceByToken(token)
  if (!device)
    return NextResponse.json({ error: 'Invalid device token' }, { status: 401, headers: CORS })

  let body: { messages?: ChatMsg[]; language?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: CORS })
  }

  // Keep only the last ~12 turns to bound the prompt, and drop empties.
  const messages: ChatMsg[] = (body.messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && (m.content || '').trim())
    .slice(-12)
  if (!messages.length || messages[messages.length - 1].role !== 'user')
    return NextResponse.json({ error: 'No question' }, { status: 400, headers: CORS })

  const user = await prisma.user.findUnique({ where: { id: device.userId } })
  const name = user?.name || user?.email?.split('@')[0] || null
  const language = body.language || 'en-US'

  const reply =
    (await llmChat({
      system: persona(name, language),
      messages,
      search: true,
      maxTokens: 400,
      temperature: 0.85,
    })) || "I'm having trouble reaching my brain right now — check the assistant connection and try again."

  const audio = await generateSpeech(reply)

  return NextResponse.json({ reply, audio }, { headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
