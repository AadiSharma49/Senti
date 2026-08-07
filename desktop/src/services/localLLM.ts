/**
 * Local LLM via Ollama — zero cloud calls.
 *
 * All inference happens on this machine. The model runs locally, no data
 * leaves the PC. This replaces the Groq/Gemini cloud path entirely.
 */

const OLLAMA_HOST = 'http://localhost:11434'

export interface LocalChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LocalChatOptions {
  model?: string
  system?: string
  temperature?: number
  maxTokens?: number
  tools?: unknown
  stream?: boolean
}

/**
 * Chat with a local Ollama model. Returns the assistant's reply text.
 */
export async function localChat(
  messages: LocalChatMessage[],
  opts: LocalChatOptions = {}
): Promise<{ text: string; toolCall?: { name: string; args: Record<string, unknown> } | null }> {
  const model = opts.model || 'qwen2.5-coder:14b'
  const url = `${OLLAMA_HOST}/api/chat`

  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.7,
      num_predict: opts.maxTokens ?? 512,
    },
  }
  if (opts.system) {
    body.system = opts.system
  }
  if (opts.tools) {
    body.tools = opts.tools
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Ollama error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data?.message?.content || ''
  const toolCalls = data?.message?.tool_calls

  let toolCall: { name: string; args: Record<string, unknown> } | null = null
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const tc = toolCalls[0]
    if (tc?.function?.name) {
      toolCall = {
        name: tc.function.name,
        args: (tc.function.arguments as Record<string, unknown>) || {},
      }
    }
  }

  return { text, toolCall }
}

/**
 * Check if Ollama is running and which models are available.
 */
export async function getOllamaStatus(): Promise<{ running: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return { running: false, models: [] }
    const data = await res.json()
    const models = (data?.models || []).map((m: { name: string }) => m.name)
    return { running: true, models }
  } catch {
    return { running: false, models: [] }
  }
}

/**
 * Pull a model from Ollama's registry.
 */
export async function pullOllamaModel(modelName: string, onProgress?: (pct: number) => void): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
      signal: AbortSignal.timeout(600_000),
    })

    if (!res.ok) return false

    const reader = res.body?.getReader()
    if (!reader) return false

    const decoder = new TextDecoder()
    let lastTotal = 0
    let lastCompleted = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n').filter(Boolean)) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.total && parsed.completed && onProgress) {
            const pct = Math.round((parsed.completed / parsed.total) * 100)
            if (pct !== lastTotal) {
              lastTotal = pct
              onProgress(pct)
            }
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }
    return true
  } catch {
    return false
  }
}
