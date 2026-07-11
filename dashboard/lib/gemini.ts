/**
 * Google Gemini client — powers Senti's assistant (greetings + conversation).
 * Uses the Generative Language REST API with optional Google Search grounding
 * so the assistant can answer with real, current information.
 *
 * Server-side only. The key is read from GEMINI_API_KEY (falls back to
 * GOOGLE_API_KEY / ANTHROPIC_API_KEY so existing setups keep working).
 */
const KEY =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.ANTHROPIC_API_KEY || ''
export const geminiEnabled = !!KEY

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface GenOpts {
  system: string
  messages: ChatMsg[]
  search?: boolean
  maxTokens?: number
  temperature?: number
}

/** Generate a reply from Gemini. Returns text, or null on failure. */
export async function geminiGenerate(opts: GenOpts): Promise<string | null> {
  if (!KEY) return null
  const contents = opts.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 300,
      temperature: opts.temperature ?? 0.9,
    },
  }
  if (opts.search) body.tools = [{ google_search: {} }]

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    if (!res.ok) {
      // The search tool isn't available on every model/tier — retry without it.
      if (opts.search) return geminiGenerate({ ...opts, search: false })
      return null
    }
    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts
    const text: string = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => p.text || '').join(' ').trim()
      : ''
    return text || null
  } catch {
    return null
  }
}
