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
  /** Tried in order if the primary model is gone (hosted IDs get retired). */
  fallbackModels?: string[]
}

function resolveOpenAICompat(): Provider | null {
  const model = process.env.LLM_MODEL
  if (process.env.GROQ_API_KEY)
    return {
      key: process.env.GROQ_API_KEY,
      // Llama 3.3 70B: fast (~240ms) and stable. NOTE: we previously defaulted
      // to llama-4-scout and Groq removed it from the account within days —
      // hosted model IDs disappear without warning, which is why fallbackModels
      // exists below. Override with LLM_MODEL.
      baseUrl: 'https://api.groq.com/openai/v1',
      model: model || 'llama-3.3-70b-versatile',
      name: 'groq',
      fallbackModels: ['qwen/qwen3.6-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
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
  /** OpenAI-style tool definitions, so the model can decide to ACT. */
  tools?: unknown[]
}

/** What the model wants Senti to do on the machine. */
export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ChatResult {
  text: string | null
  toolCall: ToolCall | null
}

async function callModel(p: Provider, model: string, opts: ChatOpts): Promise<
  { ok: true; result: ChatResult } | { ok: false; modelGone: boolean }
> {
  const messages = [
    { role: 'system', content: opts.system },
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ]
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.85,
        ...(opts.tools?.length ? { tools: opts.tools, tool_choice: 'auto' } : {}),
      }),
    })
    if (!res.ok) {
      // 404 / "model_not_found" => this model was retired; try the next one.
      const body = await res.text().catch(() => '')
      const modelGone = res.status === 404 || /model_not_found|does not exist/i.test(body)
      if (modelGone) console.error(`[senti] model "${model}" unavailable — falling back`)
      return { ok: false, modelGone }
    }
    const data = await res.json()
    const msg = data?.choices?.[0]?.message
    const text = typeof msg?.content === 'string' ? msg.content.trim() : ''

    // The model may answer, act, or both.
    let toolCall: ToolCall | null = null
    const raw = msg?.tool_calls?.[0]
    if (raw?.function?.name) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(raw.function.arguments || '{}')
      } catch {
        args = {}
      }
      toolCall = { name: raw.function.name, args }
    }

    if (!text && !toolCall) return { ok: false, modelGone: false }
    return { ok: true, result: { text: text || null, toolCall } }
  } catch {
    return { ok: false, modelGone: false }
  }
}

async function openAICompatChat(p: Provider, opts: ChatOpts): Promise<ChatResult | null> {
  // Primary model, then any fallbacks — a retired model must never silently
  // take the assistant offline.
  for (const model of [p.model, ...(p.fallbackModels ?? [])]) {
    const r = await callModel(p, model, opts)
    if (r.ok) return r.result
    if (!r.modelGone) return null // a real failure (auth, rate limit) — don't churn
  }
  return null
}

/**
 * Full result from the active brain: what to say, and optionally what to DO.
 * Only OpenAI-compatible providers support tools; Gemini falls back to text.
 */
export async function llmChatRich(opts: ChatOpts): Promise<ChatResult | null> {
  if (provider) {
    const out = await openAICompatChat(provider, opts)
    if (out) return out
    // If the primary provider failed and Gemini is also set, fall through.
  }
  if (geminiEnabled) {
    const text = await geminiGenerate(opts)
    return text ? { text, toolCall: null } : null
  }
  return null
}

/** Generate a reply from the active brain. Returns text, or null on failure. */
export async function llmChat(opts: ChatOpts): Promise<string | null> {
  const r = await llmChatRich(opts)
  return r?.text ?? null
}
