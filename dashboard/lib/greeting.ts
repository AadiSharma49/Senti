import Anthropic from '@anthropic-ai/sdk'

/**
 * AI greeting generator. When ANTHROPIC_API_KEY is set, Senti's assistant
 * (Claude Opus 4.8) composes a fresh spoken greeting on each unlock. Without
 * a key it falls back to a varied local greeting so the feature still works.
 *
 * Runs server-side only — the API key never reaches the desktop client.
 */
const KEY = process.env.ANTHROPIC_API_KEY
export const aiGreetingEnabled = !!KEY

const client = KEY ? new Anthropic({ apiKey: KEY }) : null

function timeOfDay(): string {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}

function localGreeting(name?: string | null): string {
  const part = timeOfDay()
  const cap = `Good ${part}`
  const who = name ? `, ${name}` : ''
  const options = [
    `${cap}${who}. Systems are green and ready.`,
    `${cap}${who}. Welcome back — everything's secure.`,
    `${cap}${who}. You're verified. Let's get to work.`,
    `Welcome back${who}. All systems nominal.`,
    `${cap}${who}. Good to hear your voice again.`,
  ]
  return options[Math.floor(Math.random() * options.length)]
}

export async function generateGreeting(opts: {
  name?: string | null
  deviceName?: string | null
  language?: string | null
}): Promise<string> {
  if (!client) return localGreeting(opts.name)
  const language = opts.language || 'en-US'
  try {
    const res = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 120,
      system:
        'You are Senti, an AI security assistant — think Jarvis from Iron Man: calm, sharp, quietly confident. ' +
        'You greet your owner the moment their computer unlocks by voice. ' +
        'Reply with ONE short spoken greeting, at most ~15 words. Vary it every time — warm, witty, calm, or motivational, ' +
        'your choice. Never reuse a stock phrase. Plain text only: no emoji, no quotation marks, no preamble — just the words to speak.',
      messages: [
        {
          role: 'user',
          content:
            `Time of day: ${timeOfDay()}. Owner's name: ${opts.name || 'unknown'}. Device: ${
              opts.deviceName || 'this computer'
            }. ` +
            `Speak in the language of BCP-47 locale "${language}" (respond ONLY in that language; if it is English, use English). ` +
            `Generate the greeting.`,
        },
      ],
    })
    const block = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const text = block?.text.trim()
    return text && text.length > 0 ? text : localGreeting(opts.name)
  } catch {
    return localGreeting(opts.name)
  }
}
