import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { generateGreeting } from '@/lib/greeting'
import { generateSpeech } from '@/lib/tts'

/**
 * Device greeting endpoint — the desktop authenticates with its device token
 * and gets a fresh spoken greeting to play on unlock. LLM and voice keys stay
 * server-side; the desktop only receives the finished greeting and audio.
 *
 * Called from the desktop's Electron main process, never a browser, so there
 * is no CORS here by design (see lib/deviceAuth.ts).
 */
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await authenticateDevice(req, 'greeting')
  if (!auth.ok) return auth.response
  const { device } = auth

  const user = await prisma.user.findUnique({ where: { id: device.userId } })
  const name = user?.name || user?.email?.split('@')[0] || null
  const language = (new URL(req.url).searchParams.get('lang') || 'en-US').slice(0, 20)

  const greeting = await generateGreeting({ name, deviceName: device.name, language })
  // Human voice (ElevenLabs) if configured; null → desktop uses browser TTS.
  const audio = await generateSpeech(greeting)

  return NextResponse.json({ greeting, audio }, { headers: NO_STORE })
}
