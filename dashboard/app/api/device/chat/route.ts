import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { llmChatRich, type ChatMsg } from '@/lib/llm'

/**
 * Real current tech headlines from Hacker News — free, no API key, genuinely
 * live. The brain (Groq Llama) has a knowledge cutoff and no web access, so
 * without this "what's the latest in tech" gets a blank stare. We fetch the
 * real headlines and let Senti read them out.
 */
async function fetchTechHeadlines(limit = 10): Promise<{ title: string; url?: string }[]> {
  try {
    const ids: number[] = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      signal: AbortSignal.timeout(6000),
    }).then((r) => r.json())
    const items = await Promise.all(
      ids.slice(0, limit).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(6000) })
          .then((r) => r.json())
          .catch(() => null)
      )
    )
    return items
      .filter((i): i is { title: string; url?: string } => !!i && typeof i.title === 'string')
      .map((i) => ({ title: i.title, url: i.url }))
      .slice(0, limit)
  } catch {
    return []
  }
}

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
        "Open ANY installed application, GAME, or website on the user's computer. Use this whenever they ask to open, launch, start, run, play, pull up, bring up, or go to something — e.g. \"open Chrome\", \"launch Spotify\", \"play Spider-Man\", \"open Rockstar Games\", \"pull up YouTube\". The PC searches everything actually installed, so ALWAYS try this for any app or game name rather than saying you can't — never claim you can't open something before trying.",
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
      name: 'open_folder',
      description:
        'Open one of the user\'s folders in File Explorer. Use for "open my downloads", "show me my documents", "open the desktop folder", "open recycle bin". The name is a place, not a path.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'The folder name only: downloads, documents, desktop, pictures, music, videos, home, recycle bin, or this pc.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_file',
      description:
        'Find a file by name across the user\'s folders (Desktop, Documents, Downloads, Pictures, Videos, Music) and open it. Use for "open my resume", "find that invoice and open it", "open the budget spreadsheet".',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Part of the file name to search for, e.g. "resume", "invoice march", "budget".',
          },
        },
        required: ['query'],
      },
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
      name: 'get_tech_news',
      description:
        'Fetch the REAL current top technology headlines (from Hacker News) and tell the user about them. Use whenever they ask about the latest in tech, tech news, what is happening in technology, or trending tech stories. You have no live web knowledge otherwise, so ALWAYS use this instead of guessing or saying you cannot.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Open a web search in the user\'s browser for something you cannot answer from your own knowledge — a current fact, a place, a product, a "show me X". Use for "search for…", "look up…", "show me…" when it needs the live web.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search the web for.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'screen_share',
      description:
        "Start or stop streaming this PC's screen so the owner can watch it live from their phone or laptop. Use for \"share my screen\", \"let me see my screen on my phone\", \"stop sharing my screen\".",
      parameters: {
        type: 'object',
        properties: {
          on: { type: 'boolean', description: 'true to start sharing, false to stop' },
        },
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
const KNOWN_ACTIONS = new Set([
  'open_app', 'close_app', 'open_folder', 'open_file', 'web_search', 'clean_temp',
  'empty_recycle_bin', 'lock_workstation', 'set_volume', 'screen_share', 'remember',
])
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
    'know something current, say so plainly instead of inventing it. ' +
    'Have a spine: if the owner is about to do something risky, is mistaken, or asks for something that ' +
    "won't get them what they actually want, SAY SO plainly and say why — a real assistant pushes back, it " +
    "doesn't just obey. Offer the better option. But once they've heard you and still want it, it's their " +
    'machine — do it. You are helpful AND honest, never a yes-man. ' +
    'You genuinely CAN act on this machine: open and close apps, open files and folders, empty the recycle ' +
    'bin, clean temp files, control volume, lock the PC, and remember things about the owner — do those ' +
    'through your tools rather than saying you cannot. For anything not yet wired, say what you would do and ' +
    "that it's coming. " +
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

  // Groq/Llama sometimes writes the tool call as PLAIN TEXT instead of a
  // structured call — "<function=web_search{...}>". Left alone, Senti would
  // speak that gibberish. Recover it into a real call and scrub the text.
  let call = result?.toolCall
  let recoveredText = result?.text || ''
  if (!call && recoveredText.includes('<function')) {
    const m = recoveredText.match(/<function[=\\:\s]*([a-z_]+)\s*(\{[\s\S]*?\})?/i)
    const named = m?.[1] || ''
    if (m && (KNOWN_ACTIONS.has(named) || named === 'get_tech_news')) {
      let parsedArgs: Record<string, unknown> = {}
      try {
        parsedArgs = m[2] ? JSON.parse(m[2]) : {}
      } catch {
        // keep empty args
      }
      call = { name: named, args: parsedArgs }
      recoveredText = recoveredText.replace(m[0], '').replace(/<\/?function[^>]*>/gi, '').trim()
    }
  }

  // Tech news is fulfilled HERE, on the server: fetch the real headlines, then
  // ask the brain to talk about them. The desktop sees a normal spoken reply.
  if (call?.name === 'get_tech_news') {
    const heads = await fetchTechHeadlines(10)
    if (heads.length) {
      const list = heads.map((h, i) => `${i + 1}. ${h.title}`).join('\n')
      const second = await llmChatRich({
        system:
          persona(name, language) +
          '\n\nThese are the REAL top technology headlines on Hacker News right now:\n' +
          list +
          '\nTalk the owner through the few most interesting ones out loud — 2 to 4 sentences, ' +
          'conversational, say why they matter. Do not read the whole list or number them.',
        messages,
        maxTokens: 320,
        temperature: 0.8,
      })
      const spoken =
        second?.text ||
        'Here are the top tech stories right now: ' + heads.slice(0, 4).map((h) => h.title).join('; ') + '.'
      const audio = await generateSpeech(spoken)
      return NextResponse.json({ reply: spoken, audio, action: null }, { headers: NO_STORE })
    }
    // Couldn't reach the feed — fall through to a normal reply.
  }

  // The model can answer, act, or both. Turn an action into something to say,
  // so the user always hears a confirmation.
  let action: { name: string; args: Record<string, unknown> } | null = null
  let reply = recoveredText

  if (call && KNOWN_ACTIONS.has(call.name)) {
    // Only pass through arguments we understand, capped.
    const args: Record<string, unknown> = {}
    if (typeof call.args?.name === 'string') args.name = call.args.name.slice(0, 60)
    if (typeof call.args?.direction === 'string') args.direction = call.args.direction.slice(0, 10)
    if (typeof call.args?.query === 'string') args.query = call.args.query.slice(0, 80)
    if (typeof call.args?.fact === 'string') args.fact = call.args.fact.slice(0, 300)
    if (typeof call.args?.on === 'boolean') args.on = call.args.on
    action = { name: call.name, args }

    // The desktop replaces this with the real outcome, but we always have
    // something to say if it can't.
    if (!reply) {
      reply =
        call.name === 'open_app'
          ? `Opening ${args.name ?? 'that'}.`
          : call.name === 'close_app'
          ? `Closing ${args.name ?? 'that'}.`
          : call.name === 'open_folder'
          ? `Opening ${args.name ?? 'that folder'}.`
          : call.name === 'open_file'
          ? `Looking for ${args.query ?? 'that file'}.`
          : call.name === 'web_search'
          ? `Searching the web for ${args.query ?? 'that'}.`
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

  // No reply and no action usually means a bare "hello" confused the
  // tool-augmented model into returning nothing (or a bogus tool call). Don't
  // show a scary error for that — ask once more with NO tools to force a plain,
  // conversational answer.
  if (!reply && !action) {
    const rescue = await llmChatRich({
      system: persona(name, language) + systemContext(system) + memoryContext(memories),
      messages,
      maxTokens: 200,
      temperature: 0.7,
    })
    if (rescue?.text) reply = rescue.text
  }

  if (!reply) {
    // Keep it human. "Check your connection" reads as broken for what's usually
    // just the model having an off moment — and the backend was clearly reached.
    reply =
      result === null
        ? "I'm here, but my thinking's running slow right now — give me a second and try again."
        : "I'm here — what do you need?"
  }

  const audio = await generateSpeech(reply)

  return NextResponse.json({ reply, audio, action }, { headers: NO_STORE })
}
