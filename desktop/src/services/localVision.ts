/**
 * Local vision via Ollama — see the screen without cloud APIs.
 *
 * Uses LLaVA or any Ollama vision model. The image stays on this machine;
 * only the base64 payload goes to localhost:11434.
 */

const OLLAMA_HOST = 'http://localhost:11434'

export interface VisionOptions {
  model?: string
  question?: string
  language?: string
}

/**
 * Ask a local vision model about a screenshot.
 * Returns null if Ollama isn't running or the model isn't available.
 */
export async function localVision(image: string, opts: VisionOptions = {}): Promise<string | null> {
  const model = opts.model || 'llava:7b'
  const question = opts.question || 'What is on this screen? Describe what you see and what the user might need help with.'

  // Strip the data URI prefix — Ollama wants raw base64.
  const base64 = image.replace(/^data:[^;]+;base64,/, '')

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: question,
        images: [base64],
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 300,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return (data?.response || '').trim() || null
  } catch {
    return null
  }
}

/**
 * Structured screen context via local vision model.
 * Returns the same shape as the cloud version — apps, activity, label.
 */
export async function localScreenContext(image: string): Promise<{
  summary: string
  apps: string[]
  activity: string
  label: string
} | null> {
  const base64 = image.replace(/^data:[^;]+;base64,/, '')
  const prompt =
    'Look at this screenshot. Return a JSON object with: "summary" (1-2 sentences), ' +
    '"apps" (array of app names, max 6), "activity" (one of: coding,gaming,browsing,watching,reading,writing,working,idle), ' +
    '"label" (short label like "Coding in VS Code"). No markdown, just JSON.'

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava:7b',
        prompt,
        images: [base64],
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 400,
        },
        format: 'json',
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) return null
    const data = await res.json()
    const text = data?.response || ''
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) return null
      const obj = JSON.parse(match[0])
      return {
        summary: String(obj.summary || '').slice(0, 500),
        apps: Array.isArray(obj.apps) ? obj.apps.slice(0, 8) : [],
        activity: String(obj.activity || '').toLowerCase(),
        label: String(obj.label || '').slice(0, 80),
      }
    } catch {
      return null
    }
  } catch {
    return null
  }
}
