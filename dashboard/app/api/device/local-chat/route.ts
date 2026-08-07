import { NextResponse } from 'next/server'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

/**
 * Local chat endpoint — proxies to Ollama on this machine.
 *
 * Only works when the device is in local mode. This lets the desktop app
 * keep using the same API path while all inference happens on localhost.
 * No data leaves this machine.
 */
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'chat')
  if (!auth.ok) return auth.response

  // Only allow local mode devices through this endpoint.
  if (!auth.device?.localMode) {
    return NextResponse.json({ error: 'Local mode required' }, { status: 403, headers: NO_STORE })
  }

  const body = await req.json().catch(() => ({}))
  const messages = Array.isArray(body.messages) ? body.messages : []
  const system = typeof body.system === 'string' ? body.system : null
  const model = typeof body.model === 'string' ? body.model : 'qwen2.5-coder:14b'

  if (!messages.length) {
    return NextResponse.json({ error: 'No messages' }, { status: 400, headers: NO_STORE })
  }

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        system,
        stream: false,
        options: {
          temperature: 0.85,
          num_predict: 400,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => 'Ollama error')
      return NextResponse.json({ error: `Ollama: ${err}` }, { status: 502, headers: NO_STORE })
    }

    const data = await res.json()
    const text = data?.message?.content || ''
    const toolCalls = data?.message?.tool_calls

    let action: { name: string; args: Record<string, unknown> } | null = null
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const tc = toolCalls[0]
      if (tc?.function?.name) {
        action = {
          name: tc.function.name,
          args: (tc.function.arguments as Record<string, unknown>) || {},
        }
      }
    }

    return NextResponse.json({ reply: text, audio: null, action }, { headers: NO_STORE })
  } catch (err) {
    return NextResponse.json({ error: `Ollama unreachable: ${err}` }, { status: 502, headers: NO_STORE })
  }
}
