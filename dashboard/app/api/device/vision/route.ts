import { NextResponse } from 'next/server'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { describeImage, describeScreenContext, type ScreenContextResult } from '@/lib/vision'
import { generateSpeech } from '@/lib/tts'

/**
 * "Look at my screen and help me with this."
 *
 * Two modes:
 *  1. USER ASKED: desktop grabs one frame, sends it here, gets a text answer.
 *     The image is used for this answer and never stored.
 *  2. BACKGROUND WATCH: every 3s the desktop sends a frame with `context: true`
 *     in the body. We return structured JSON (apps, activity, label) instead
 *     of a spoken reply — no TTS needed, the desktop just stores the context.
 */
export const runtime = 'nodejs'

/** A downscaled screenshot is ~200-600KB as base64; this leaves headroom. */
const MAX_IMAGE_CHARS = 4_000_000

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'chat')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const image = typeof body.image === 'string' ? body.image : ''
  const question = typeof body.question === 'string' ? body.question.slice(0, 400) : ''
  const language = typeof body.language === 'string' ? body.language.slice(0, 20) : 'en-US'
  const isContext = body.context === true

  if (!image.startsWith('data:image') || image.length > MAX_IMAGE_CHARS)
    return NextResponse.json({ error: 'Bad image' }, { status: 400, headers: NO_STORE })

  // Background watcher: return structured context, no TTS.
  if (isContext) {
    const ctx = await describeScreenContext(image)
    if (!ctx) {
      return NextResponse.json({ error: 'Vision busy' }, { status: 503, headers: NO_STORE })
    }
    return NextResponse.json({ context: ctx }, { headers: NO_STORE })
  }

  // User asked: get a text answer and voice it.
  const answer = await describeImage(image, question || 'What am I looking at, and what should I do?', language)
  if (!answer) {
    const spoken = "I couldn't get a look at your screen just now — my eyes are busy. Try me again in a moment."
    return NextResponse.json({ reply: spoken, audio: await generateSpeech(spoken) }, { headers: NO_STORE })
  }

  return NextResponse.json({ reply: answer, audio: await generateSpeech(answer) }, { headers: NO_STORE })
}
