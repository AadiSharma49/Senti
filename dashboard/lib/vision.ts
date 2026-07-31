/**
 * Looking at a screenshot and saying something useful about it.
 *
 * Runs on the same Groq key as everything else — qwen3.6-27b accepts images,
 * so this needs no new provider. Gemini is the fallback for when Groq's vision
 * model is over capacity, which it visibly is from time to time.
 *
 * Nothing here stores the image. It exists for the length of one answer.
 */
import { geminiEnabled } from './gemini'

const GROQ_KEY = process.env.GROQ_API_KEY || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''

/** Models that take an image, in order of preference. */
const GROQ_VISION = ['qwen/qwen3.6-27b']

/**
 * The instruction matters as much as the model here. Asked to "describe this
 * screenshot", a vision model narrates the furniture — "a dark IDE with a file
 * tree on the left" — which the person staring at it already knows. What they
 * asked for is the ANSWER.
 */
function prompt(question: string, language: string): string {
  return (
    "You are Senti, looking at a screenshot of your owner's screen because they asked you to. " +
    `Their question: "${question}"\n\n` +
    'Answer THAT, out loud, in one or two sentences. Speak like a friend leaning over their ' +
    'shoulder — say the useful thing, not what you can see. ' +
    'If there is an error on screen, say what it means and the fix. If it is a game, say what ' +
    'to do next. If it is code, point at the actual problem. ' +
    'Never narrate the layout, never list what is visible, never say "this screenshot shows". ' +
    "If you genuinely cannot tell what they need, say so in one line and ask what they're stuck on. " +
    `Reply in BCP-47 "${language}". No markdown, no lists, no preamble.`
  )
}

/** Strip a reasoning model's private thinking; see the note in llm.ts. */
function clean(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const open = out.search(/<think>/i)
  if (open !== -1) out = out.slice(0, open)
  return out.trim()
}

async function askGroqVision(image: string, question: string, language: string): Promise<string | null> {
  if (!GROQ_KEY) return null
  for (const model of GROQ_VISION) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          // Generous on purpose. This model REASONS before answering, and that
          // reasoning counts against the budget — at 300 tokens the <think>
          // block consumed all of it, so stripping the thinking left an empty
          // string and the whole feature silently reported "I couldn't look".
          // The answer itself is still one or two sentences.
          max_tokens: 1200,
          temperature: 0.6,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt(question, language) },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) continue // over capacity or gated — try the next option
      const data = await res.json()
      const text = clean(data?.choices?.[0]?.message?.content ?? '')
      if (text) return text
    } catch {
      // Try the next model.
    }
  }
  return null
}

async function askGeminiVision(image: string, question: string, language: string): Promise<string | null> {
  if (!GEMINI_KEY) return null
  const m = image.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!m) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt(question, language) }, { inline_data: { mime_type: m[1], data: m[2] } }],
            },
          ],
          generationConfig: { maxOutputTokens: 300, temperature: 0.6 },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts
    const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text || '').join(' ') : ''
    return clean(text) || null
  } catch {
    return null
  }
}

/** Answer a question about a screenshot. Null when no model could look. */
export async function describeImage(
  image: string,
  question: string,
  language: string
): Promise<string | null> {
  const groq = await askGroqVision(image, question, language)
  if (groq) return groq
  if (geminiEnabled) return askGeminiVision(image, question, language)
  return null
}
