import { api } from './api'
import { deviceLang } from './greetingService'

/**
 * "Have a look at this and help me."
 *
 * Grabs ONE frame of the screen, at the moment you asked, and sends it to be
 * described. Nothing runs on a timer and nothing is kept: the image exists for
 * the length of one answer.
 *
 * That distinction is the whole design. A single frame you asked for is
 * ordinary software; a loop sampling your screen unprompted is surveillance,
 * and it is deliberately not built.
 */
const VISION_PATH = '/api/device/vision'

export async function lookAtScreen(question: string): Promise<string> {
  const image = await window.senti?.screenshotGrab?.()
  if (!image) return "I couldn't get a look at your screen just now."

  const res = await api<{ reply?: string }>(VISION_PATH, {
    method: 'POST',
    body: { image, question, language: deviceLang() },
  })

  if (!res.ok || !res.data?.reply) {
    return res.status === 429
      ? "I'm looking at too much at once — give me a second and ask again."
      : "I had a look but couldn't make sense of it just now."
  }
  return res.data.reply
}
