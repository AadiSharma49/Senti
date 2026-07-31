import { NextResponse } from 'next/server'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { describeImage } from '@/lib/vision'
import { generateSpeech } from '@/lib/tts'

/**
 * "Look at my screen and help me with this."
 *
 * The desktop grabs ONE frame — because you asked, at the moment you asked —
 * and sends it here to be described. There is no history: the image is used
 * for this answer and never stored, which is the difference between a feature
 * and a log of everything you've ever had on screen.
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

  if (!image.startsWith('data:image') || image.length > MAX_IMAGE_CHARS)
    return NextResponse.json({ error: 'Bad image' }, { status: 400, headers: NO_STORE })

  const answer = await describeImage(image, question || 'What am I looking at, and what should I do?', language)
  if (!answer) {
    const spoken = "I couldn't get a look at your screen just now — my eyes are busy. Try me again in a moment."
    return NextResponse.json({ reply: spoken, audio: await generateSpeech(spoken) }, { headers: NO_STORE })
  }

  return NextResponse.json({ reply: answer, audio: await generateSpeech(answer) }, { headers: NO_STORE })
}
