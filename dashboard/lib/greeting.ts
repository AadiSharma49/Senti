import { llmChat, llmEnabled } from './llm'

/**
 * AI greeting generator. When a brain is configured (Groq / Grok / OpenAI /
 * Gemini — see lib/llm.ts), Senti composes a fresh spoken greeting on each
 * unlock. Without one it falls back to a varied local greeting so the feature
 * still works.
 *
 * Runs server-side only — the key never reaches the desktop.
 */
export const aiGreetingEnabled = llmEnabled

function timeOfDay(): string {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}

function localGreeting(name?: string | null): string {
  const cap = `Good ${timeOfDay()}`
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
  const language = opts.language || 'en-US'
  const text = await llmChat({
    system:
      'You are Senti, an AI security assistant — think Jarvis from Iron Man: calm, sharp, quietly confident. ' +
      'You greet your owner the moment their computer unlocks by voice. ' +
      'Reply with ONE short spoken greeting, at most ~15 words. Vary it every time — warm, witty, calm, or ' +
      'motivational, your choice. Never reuse a stock phrase. Plain text only: no emoji, no quotation marks, ' +
      'no preamble — just the words to speak.',
    messages: [
      {
        role: 'user',
        content:
          `Time of day: ${timeOfDay()}. Owner's name: ${opts.name || 'unknown'}. Device: ${
            opts.deviceName || 'this computer'
          }. ` +
          `Speak in the language of BCP-47 locale "${language}" (respond ONLY in that language). Generate the greeting.`,
      },
    ],
    maxTokens: 80,
  })
  return text || localGreeting(opts.name)
}
