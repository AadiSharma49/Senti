import { geminiGenerate, geminiEnabled } from './gemini'
import type { ChatMsg } from './gemini'

export type { ChatMsg } from './gemini'

/**
 * Provider-agnostic LLM router for Senti's assistant.
 *
 * Prefers any OpenAI-compatible provider that's configured (Groq, xAI Grok,
 * OpenAI, or a custom base URL), and falls back to Google Gemini. Switching
 * brains is just an env change — no code edits:
 *
 *   GROQ_API_KEY=gsk_...            -> Groq (free, Llama 3.3 70B)
 *   XAI_API_KEY=xai-...             -> xAI Grok
 *   OPENAI_API_KEY=sk-...           -> OpenAI
 *   LLM_API_KEY + LLM_BASE_URL      -> any custom OpenAI-compatible endpoint
 *   LLM_MODEL=...                   -> override the model for any of the above
 *   GEMINI_API_KEY=...              -> Google Gemini (also enables web search)
 *
 * Server-side only. Keys never reach the desktop.
 */

interface Provider {
  key: string
  baseUrl: string
  model: string
  name: string
}

function resolveOpenAICompat(): Provider | null {
  const model = process.env.LLM_MODEL
  if (process.env.GROQ_API_KEY)
    return {
      key: process.env.GROQ_API_KEY,
      // Llama 4 Scout: newest generation, fast (~150ms first token on Groq),
      // clean for short spoken replies. Override with LLM_MODEL.
      baseUrl: 'https://api.groq.com/openai/v1',
      model: model || 'meta-llama/llama-4-scout-17b-16e-instruct',
      name: 'groq',
    }
  if (process.env.XAI_API_KEY)
    return {
      key: process.env.XAI_API_KEY,
      baseUrl: 'https://api.x.ai/v1',
      model: model || 'grok-2-latest',
      name: 'xai',
    }
  if (process.env.OPENAI_API_KEY)
    return {
      key: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      model: model || 'gpt-4o-mini',
      name: 'openai',
    }
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL)
    return {
      key: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL.replace(/\/$/, ''),
      model: model || 'gpt-4o-mini',
      name: 'custom',
    }
  return null
}

const provider = resolveOpenAICompat()

/** True if any brain is configured. */
export const llmEnabled = !!provider || geminiEnabled
/** Which provider is active (for diagnostics). */
export const llmProvider = provider?.name || (geminiEnabled ? 'gemini' : 'none')

export interface ChatOpts {
  system: string
  messages: ChatMsg[]
  maxTokens?: number
  temperature?: number
  /** Live web search — only Gemini honors this; ignored by other providers. */
  search?: boolean
}

async function openAICompatChat(p: Provider, opts: ChatOpts): Promise<string | null> {
  const messages = [
    { role: 'system', content: opts.system },
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ]
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: p.model,
        messages,
        max_tokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.85,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

/** Generate a reply from the active brain. Returns text, or null on failure. */
export async function llmChat(opts: ChatOpts): Promise<string | null> {
  if (provider) {
    const out = await openAICompatChat(provider, opts)
    if (out) return out
    // If the primary provider failed and Gemini is also set, fall through.
  }
  if (geminiEnabled) return geminiGenerate(opts)
  return null
}
