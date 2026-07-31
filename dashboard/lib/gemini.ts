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

/**
 * Google retires and gates model IDs without warning — `gemini-2.5-flash` is
 * listed by the API but returns 404 "no longer available to new users". So the
 * default is a widely-available one, with fallbacks tried in order.
 */
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const FALLBACK_MODELS = ['gemini-2.0-flash-001', 'gemini-2.0-flash-lite', 'gemini-2.5-pro']

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

  // Walk the model list: a gated or retired ID should fall to the next one
  // rather than taking the whole capability offline.
  for (const model of [MODEL, ...FALLBACK_MODELS]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      if (!res.ok) {
        // 429 means this key has no quota left — every model will say the same,
        // so stop rather than hammering four of them for the same answer.
        if (res.status === 429) {
          console.error('[senti] Gemini quota exhausted — live web answers unavailable')
          return null
        }
        // The search tool isn't available on every model/tier — retry without it.
        if (opts.search) return geminiGenerate({ ...opts, search: false })
        continue
      }
      const data = await res.json()
      const parts = data?.candidates?.[0]?.content?.parts
      const text: string = Array.isArray(parts)
        ? parts.map((p: { text?: string }) => p.text || '').join(' ').trim()
        : ''
      if (text) return text
    } catch {
      // Network blip — try the next model.
    }
  }
  return null
}
