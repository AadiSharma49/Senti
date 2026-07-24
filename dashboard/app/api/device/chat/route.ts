import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { llmChatRich, type ChatMsg } from '@/lib/llm'

/**
 * What Senti is allowed to DO on the machine. The desktop enforces this too —
 * it resolves the name against its own whitelist and can refuse — so the model
 * can never turn a sentence into an arbitrary command.
 */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'open_app',
      description:
        "Open an application or website on the user's computer. Use this whenever they ask to open, launch, start, run, pull up, bring up, or go to something — e.g. \"open Chrome\", \"launch Spotify\", \"pull up YouTube\", \"go to GitHub\".",
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'The app or site name only, lowercase, no path or command. Examples: chrome, spotify, notepad, task manager, youtube, github.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_app',
      description:
        'Close or quit a running application — e.g. "close Chrome", "quit Spotify", "kill Discord".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'App name only, lowercase. e.g. chrome, spotify, discord.' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clean_temp',
      description:
        'Free disk space by deleting temporary files. Use when the user asks to clean up, free space, clear junk/temp files, or says the disk is full. Also the right follow-up when they ask you to fix a slow or full machine.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'empty_recycle_bin',
      description:
        'Permanently empty the Windows Recycle Bin. Use when the user says to empty/clear the recycle bin or trash, or to delete the files already in the recycle bin. This is separate from clean_temp — recycle bin only.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lock_workstation',
      description:
        'Lock the computer (the real Windows lock). Use for "lock my PC", "lock the computer", "I am stepping away".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_volume',
      description: 'Change the system volume. Use for "turn it up", "volume down", "mute".',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'mute'], description: 'up, down, or mute' },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description:
        "Save a durable fact about the owner or their machine to Senti's long-term memory, so you don't forget it or ask again next time. Use it when they tell you a preference, a name, how their setup is arranged, or how they like things done — e.g. \"my main drive is D\", \"call me Aditya\", \"I hate apps that auto-start\". Do NOT use it for one-off requests or passing chit-chat.",
      parameters: {
        type: 'object',
        properties: {
          fact: {
            type: 'string',
            description: 'The single fact to remember, written as a short statement. e.g. "Prefers dark mode everywhere."',
          },
        },
        required: ['fact'],
      },
    },
  },
]

/** Actions the desktop knows how to run. */
const KNOWN_ACTIONS = new Set(['open_app', 'close_app', 'clean_temp', 'empty_recycle_bin', 'lock_workstation', 'set_volume', 'remember'])
import { generateSpeech } from '@/lib/tts'

/**
 * Conversational assistant endpoint — Senti's Jarvis.
 *
 * The desktop transcribes the user's spoken question on-device (Whisper), then
 * POSTs the running conversation here. We answer with the configured LLM, then
 * voice the reply with ElevenLabs. Keys stay server-side; the desktop only ever
 * sends text and receives the reply plus audio.
 *
 * Called from the desktop's Electron MAIN process, never a browser — so there
 * is no CORS here by design (see lib/deviceAuth.ts). This is also the most
 * expensive route we have, so it is the most tightly rate limited.
 */
export const runtime = 'nodejs'

/**
 * The desktop attaches a factual snapshot of the machine it runs on. This is
 * what a cloud chatbot cannot do — so tell the model to actually use it and
 * quote the real numbers rather than giving generic PC advice.
 */
function systemContext(system: string | null): string {
  if (!system) return ''
  return (
    '\n\nLIVE FACTS about the computer you are running on, captured seconds ago:\n' +
    system +
    '\nWhen the user asks anything about their machine — why it is slow, what to ' +
    'clean up, what to upgrade, what is using memory — answer from these real ' +
    'numbers and name them out loud. Never give generic advice when a real figure ' +
    'above answers the question. Keep it spoken and short.'
  )
}

/**
 * What Senti remembers about its owner — sent up from the desktop's local
 * memory file. This is the difference between a chatbot that forgets you every
 * time and an assistant that actually knows you.
 */
function memoryContext(memories: string[]): string {
  if (!memories.length) return ''
  const block = memories.map((m) => `- ${m}`).join('\n').slice(0, 1500)
  return (
    '\n\nWHAT YOU ALREADY KNOW about your owner (from past conversations — treat as true ' +
    'and use it; do NOT ask again for anything already listed here):\n' +
    block +
    '\nWhen the user tells you something durable about themselves, their machine, or how they ' +
    'like things done, call the remember tool so you keep it. Do not announce that you are ' +
    'remembering unless it feels natural.'
  )
}

function persona(name: string | null, language: string): string {
  const who = name
    ? `Your owner's name is ${name}. Use their first name occasionally and naturally, not in every line.`
    : ''
  return (
    'You are Senti — a personal AI assistant living on your owner\'s computer, in the spirit of Jarvis from ' +
    'Iron Man: calm, sharp, warm, quietly confident, and genuinely useful. You speak with your owner out loud, ' +
    'so your answers are SPOKEN. ' +
    who +
    ' Talk like a smart friend, NOT a butler. Never say "sir", "madam", "master", or any other honorific — it ' +
    'sounds servile and fake. No "How may I assist you", no "Certainly", no corporate filler. ' +
    'Keep replies conversational and concise — usually 1 to 3 sentences, as if talking, not writing an ' +
    'essay. Get to the point; no bullet lists, no markdown, no headings, no emoji. When you genuinely do not ' +
    'know something current, say so plainly instead of inventing it. If asked to do ' +
    'something you cannot do on the machine yet (open apps, control the system), say what you would do and note ' +
    "it's coming. " +
    `Default spoken language for this session: BCP-47 "${language}". Always reply in the language the user speaks to you in.`
  )
}

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'chat')
  if (!auth.ok) return auth.response
  const { device } = auth

  let body: { messages?: ChatMsg[]; language?: string; system?: string; memories?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })
  }

  // Keep only the last ~12 turns to bound the prompt, and drop empties. Also
  // cap each turn: an unbounded message is a way to burn tokens on our bill.
  const messages: ChatMsg[] = (body.messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && (m.content || '').trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
  if (!messages.length || messages[messages.length - 1].role !== 'user')
    return NextResponse.json({ error: 'No question' }, { status: 400, headers: NO_STORE })

  const user = await prisma.user.findUnique({ where: { id: device.userId } })
  const name = user?.name || user?.email?.split('@')[0] || null
  const language = (body.language || 'en-US').slice(0, 20)

  // Cap it: this is a summary, not a data dump.
  const system = typeof body.system === 'string' ? body.system.slice(0, 1500) : null

  // What the desktop remembers about this owner — capped per item and in count.
  const memories = Array.isArray(body.memories)
    ? body.memories.filter((m): m is string => typeof m === 'string' && !!m.trim()).slice(-40).map((m) => m.slice(0, 300))
    : []

  const result = await llmChatRich({
    system: persona(name, language) + systemContext(system) + memoryContext(memories),
    messages,
    search: true,
    maxTokens: 400,
    temperature: 0.85,
    tools: TOOLS,
  })

  // The model can answer, act, or both. Turn an action into something to say,
  // so the user always hears a confirmation.
  let action: { name: string; args: Record<string, unknown> } | null = null
  let reply = result?.text || ''

  const call = result?.toolCall
  if (call && KNOWN_ACTIONS.has(call.name)) {
    // Only pass through arguments we understand, capped.
    const args: Record<string, unknown> = {}
    if (typeof call.args?.name === 'string') args.name = call.args.name.slice(0, 60)
    if (typeof call.args?.direction === 'string') args.direction = call.args.direction.slice(0, 10)
    if (typeof call.args?.fact === 'string') args.fact = call.args.fact.slice(0, 300)
    action = { name: call.name, args }

    // The desktop replaces this with the real outcome, but we always have
    // something to say if it can't.
    if (!reply) {
      reply =
        call.name === 'open_app'
          ? `Opening ${args.name ?? 'that'}.`
          : call.name === 'close_app'
          ? `Closing ${args.name ?? 'that'}.`
          : call.name === 'clean_temp'
          ? 'Cleaning up temporary files.'
          : call.name === 'empty_recycle_bin'
          ? 'Emptying the Recycle Bin.'
          : call.name === 'lock_workstation'
          ? 'Locking your PC.'
          : call.name === 'remember'
          ? "Got it, I'll remember that."
          : 'Done.'
    }
  }

  if (!reply) {
    reply = "I'm having trouble reaching my brain right now — check the assistant connection and try again."
  }

  const audio = await generateSpeech(reply)

  return NextResponse.json({ reply, audio, action }, { headers: NO_STORE })
}
