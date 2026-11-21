import { api } from './api'
import { deviceLang } from './greetingService'

/**
 * "Have a look at this and help me."
 *
 * Grabs ONE frame of the screen at the moment you asked (`look_at_screen`,
 * gated by `permissions.seeScreen`) and sends it to be described. The image is
 * used for this single answer and never stored. (Continuous background screen
 * context is a separate, default-off `watchScreen` toggle in Settings.)
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
