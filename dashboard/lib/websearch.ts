/**
 * Answering a question from the live web.
 *
 * Two providers, because relying on one has already cost us:
 *
 *   1. Tavily — a search API built for this. Returns a written answer plus
 *      sources, needs no card, and doesn't care which model you run.
 *   2. Gemini with Google Search grounding — good when it works, but Google's
 *      free tier is unreliable: model IDs get gated without warning and some
 *      accounts get a ZERO free-tier allocation, visible only as a 429.
 *
 * Tavily goes first deliberately. A provider that reliably fails doesn't just
 * cost you the answer — it costs a wasted round trip on EVERY question before
 * the working one is even tried, and this is a voice assistant, where a
 * second of silence is the whole experience.
 *
 * Configure either (or both). With neither, the caller says so honestly
 * instead of guessing.
 */
import { geminiEnabled, geminiGenerate } from './gemini'
import { llmChat } from './llm'

const TAVILY_KEY = process.env.TAVILY_API_KEY || ''
export const tavilyEnabled = !!TAVILY_KEY
/** True when SOME provider can reach the web. */
export const webSearchEnabled = geminiEnabled || tavilyEnabled

/**
 * Turn a spoken question into a search query.
 *
 * Leading question words genuinely wreck the results: "what is the price of
 * bitcoin today" came back with DICTIONARY DEFINITIONS OF "WHAT" and a made-up
 * price, while "bitcoin price today" returned the live figure. The search
 * index wants keywords, not grammar.
 */
function toQuery(question: string): string {
  const q = question
    .trim()
    .replace(/^(what|who|when|where|why|how|which)\s+(is|are|was|were|does|do|did|can|will)\s+/i, '')
    .replace(/^(tell me|show me|find out|look up|search for)\s+/i, '')
    .replace(/^(the)\s+/i, '')
    .replace(/[?!.]+$/, '')
    .trim()
  // If stripping left almost nothing, the original was better than the remains.
  return q.length >= 3 ? q : question.trim()
}

/** Ask Tavily. Returns its written answer, or null. */
async function tavilyAnswer(questionRaw: string): Promise<string | null> {
  if (!TAVILY_KEY) return null
  const question = toQuery(questionRaw)
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
        // 'basic', not 'advanced'. Advanced adds several seconds, and once
        // the query is cleaned up it wasn't buying accuracy — the bad results
        // came from searching the words "what is", not from shallow digging.
        // This is spoken aloud; seconds of silence cost more than depth.
        search_depth: 'basic',
        max_results: 5,
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const answer = typeof data?.answer === 'string' ? data.answer.trim() : ''

    // Send the composed answer AND the raw snippets. On fast-moving questions
    // ("bitcoin price today") the composed answer is sometimes vague enough
    // that the rephrasing model falls back on its training and states a stale
    // figure with confidence. The snippets carry the actual numbers.
    const results: { content?: string }[] = Array.isArray(data?.results) ? data.results : []
    const snippets = results
      .map((r) => (r.content || '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .join('\n')

    if (answer && snippets) return `${answer}\n\nSources say:\n${snippets}`
    return answer || snippets || null
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
    '\n\nAnswer the question from the web results below, out loud, in one or two sentences. ' +
    'Lead with the actual answer — a number, a name, the fact itself. ' +
    // Each of these is something the rephrasing model actually did: quoted a
    // stale figure from its own training over the live result, appended "I am
    // an AI system", and told the user to go check a real source — which is
    // precisely the job it had just been given.
    'Use ONLY the figures in these results, never one you remember. ' +
    'Never say you are an AI, never tell them to check another source, never hedge that ' +
    'something changes often. No links, no markdown, no preamble.'

  const raw = await tavilyAnswer(question)
  if (raw) {
    // Tavily writes for reading, not speaking: "As of 2026-07-31, Jaipur
    // experiences a temperature of 31.1°C with a UV index of 0" is a weather
    // report, not something a friend would say. The MAIN brain rephrases it —
    // deliberately not Gemini, which is the provider likeliest to be down.
    const spoken = await llmChat({
      system: persona + style,
      messages: [{ role: 'user', content: `Question: ${question}\n\nWhat the web says:\n${raw}` }],
      maxTokens: 300,
      temperature: 0.6,
    })
    // A slightly stiff answer beats no answer.
    return spoken?.trim() || raw
  }

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

  return null
}
