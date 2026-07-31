/**
 * Answering a question from the live web.
 *
 * Two providers, tried in order, because relying on one has already cost us:
 *
 *   1. Gemini with Google Search grounding — best quality when it works. It
 *      reads the results and reasons over them rather than returning links.
 *      But Google's free tier is unreliable: model IDs get gated without
 *      warning, and some accounts get a zero free-tier allocation with no way
 *      to tell from the outside except a 429.
 *   2. Tavily — a search API built for this. Returns a written answer plus
 *      sources, needs no card for the free tier, and doesn't care which model
 *      you run.
 *
 * Whichever answers first wins. Configure either (or both) and it works; with
 * neither, the caller says so honestly instead of guessing.
 */
import { geminiEnabled, geminiGenerate } from './gemini'
import { llmChat } from './llm'

const TAVILY_KEY = process.env.TAVILY_API_KEY || ''
export const tavilyEnabled = !!TAVILY_KEY
/** True when SOME provider can reach the web. */
export const webSearchEnabled = geminiEnabled || tavilyEnabled

/** Ask Tavily. Returns its written answer, or null. */
async function tavilyAnswer(question: string): Promise<string | null> {
  if (!TAVILY_KEY) return null
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: question,
        // Tavily can compose the answer itself, which is exactly what we want
        // — the alternative is handing raw snippets to a model that then has
        // to summarise them, for no gain.
        include_answer: true,
        search_depth: 'basic',
        max_results: 5,
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const answer = typeof data?.answer === 'string' ? data.answer.trim() : ''
    if (answer) return answer

    // No composed answer — fall back to the top result snippets, which is
    // still far better than telling the user we found nothing.
    const results: { content?: string }[] = Array.isArray(data?.results) ? data.results : []
    const joined = results
      .map((r) => (r.content || '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' ')
    return joined || null
  } catch {
    return null
  }
}

/**
 * Answer `question` from the web, phrased for speaking aloud.
 *
 * `persona` is the caller's system prompt, so the answer sounds like Senti
 * rather than a search engine.
 */
export async function answerFromWeb(question: string, persona: string): Promise<string | null> {
  const style =
    '\n\nAnswer the question from what you find on the web, out loud and in one or two ' +
    'sentences. Give the actual answer first. No links, no markdown, no hedging about ' +
    'being an AI — just tell them what you found.'

  if (geminiEnabled) {
    const answer = await geminiGenerate({
      system: persona + style,
      messages: [{ role: 'user', content: question }],
      search: true,
      maxTokens: 300,
      temperature: 0.6,
    })
    if (answer?.trim()) return answer.trim()
  }

  const raw = await tavilyAnswer(question)
  if (!raw) return null

  // Tavily writes for reading, not speaking. Pass it through the MAIN brain to
  // come out in Senti's voice — deliberately not Gemini, since the usual
  // reason we're on this path at all is that Gemini is unavailable.
  const spoken = await llmChat({
    system: persona + style,
    messages: [{ role: 'user', content: `Question: ${question}\n\nWhat the web says:\n${raw}` }],
    maxTokens: 300,
    temperature: 0.6,
  })
  // A slightly stiff answer beats no answer.
  return spoken?.trim() || raw
}
