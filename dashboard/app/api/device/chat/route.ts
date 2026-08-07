import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateDevice, NO_STORE } from '@/lib/deviceAuth'
import { llmChatRich, type ChatMsg } from '@/lib/llm'
import { answerFromWeb, webSearchEnabled } from '@/lib/websearch'

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
      name: 'close_current',
      description:
        'Close or quit whatever app is currently in the foreground — the game, tab, or window the user is actually looking at right now. Use when they say "close this", "exit this game", "get me out of this", "close whatever is open", "close this window" — anything where they mean the active frontmost thing and not a named app. This is the right action when you do not know the app name.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_desktop',
      description:
        'Minimise every open window at once so the user is back at their desktop immediately. Use for "show desktop", "back to desktop", "minimise everything", "close all windows", "get back to desktop", "i want the desktop". This is the fastest way to get out of a fullscreen game or a busy screen.',
      parameters: { type: 'object', properties: {} },
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
      name: 'power',
      description:
        'Sleep, restart, or shut down the PC. Use for "go to sleep", "restart my PC", "shut down", "turn off the computer". Cannot turn the PC back ON (that needs Wake-on-LAN hardware).',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['sleep', 'restart', 'shutdown'], description: 'sleep, restart, or shutdown' },
        },
        required: ['mode'],
      },
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
      name: 'ask_web',
      description:
        "Look something up on the live web and ANSWER it out loud. Use this whenever the answer depends on current information you cannot know — today's weather, a score, a price, recent events, whether something is still true, anything after your training. Prefer this over saying you don't know or that you can't browse.",
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to answer, written in full as a standalone question.',
          },
        },
        required: ['question'],
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
      name: 'take_screenshot',
      description:
        'Take a screenshot of the screen and save it to the Pictures folder. Use for "take a screenshot", "capture my screen", "screenshot this", "grab a picture of this".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'look_at_screen',
      description:
        'LOOK at what is on the screen right now and help with it. Use whenever the user refers to something you would need to SEE: "help me with this", "what does this error mean", "what am I looking at", "I am stuck on this", "how do I fix this", "read this for me". Always prefer this over asking them to describe what they see.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'What they want to know about the screen, in their own words.',
          },
        },
        required: ['question'],
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
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the content of a file in the user\'s project. Use this when you need to see what\'s in a specific file — e.g. "read the server file", "show me the config", "what\'s in package.json". Always prefer reading the actual file over guessing what\'s in it.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Full path to the file, or relative to the workspace. e.g. "src/index.ts", "package.json"' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file — creating or overwriting it. Use this to actually build code, create config files, add routes, write components, etc. When the user says "build a chat app", "create a server", "add a login page" — this is the tool that does the work. ALWAYS write the complete file content, not just a snippet.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Full path or workspace-relative path. e.g. "src/server.ts", "package.json"' },
          text: { type: 'string', description: 'The complete file content to write. Must be the full file, not a partial update.' },
        },
        required: ['path', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the project terminal — npm install, npm run dev, git commit, etc. Use for installing dependencies, starting servers, running builds, git operations. The output comes back so you can see if it worked.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run. e.g. "npm install", "npm run dev", "git status"' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_folder',
      description: 'List files and folders in a directory. Use to understand the project structure before writing files — "what\'s in the src folder", "show me the project structure", "what files exist here".',
      parameters: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Path to the folder. e.g. "src", ".", "src/components"' },
        },
        required: ['folder'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_file',
      description: 'Get the content of whatever file is currently open in the user\'s editor. Use when they say "what am I looking at", "what\'s open", "read this file" without naming it — the active editor IS the file.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_diagnostics',
      description: 'Get the current errors and warnings from the editor. Use when something isn\'t working — "what\'s broken", "show me errors", "why isn\'t this compiling".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan',
      description: 'Create a step-by-step plan for a complex task BEFORE executing it. Use this when the user asks you to build, create, or fix something that requires multiple steps — e.g. "build a chat app", "create a React project", "set up authentication". The plan is a numbered list of steps you will execute. After creating the plan, execute each step one by one using the other tools (write_file, run_command, etc.). Do NOT announce the plan to the user — just create it and execute it.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The high-level goal the user asked for, in your own words.' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step: { type: 'number', description: 'Step number, starting from 1.' },
                action: { type: 'string', description: 'What to do in this step — which tool to use and what arguments.' },
                tool: { type: 'string', description: 'Which tool to use: run_command, write_file, list_folder, read_file, etc.' },
              },
              required: ['step', 'action', 'tool'],
            },
            description: 'Ordered list of steps to accomplish the goal.',
          },
        },
        required: ['goal', 'steps'],
      },
    },
  },
]

/** Actions the desktop knows how to run. */
const KNOWN_ACTIONS = new Set([
  'open_app', 'close_app', 'close_current', 'show_desktop',
  'open_folder', 'open_file', 'clean_temp',
  'empty_recycle_bin', 'lock_workstation', 'power', 'set_volume', 'screen_share', 'remember',
  'take_screenshot', 'look_at_screen',
  'ask_web',
  'read_file', 'write_file', 'run_command', 'list_folder', 'get_active_file', 'get_diagnostics', 'plan',
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

function screenContextPrompt(ctx: unknown): string {
  if (!ctx || typeof ctx !== 'object') return ''
  const c = ctx as { summary?: string; apps?: string[]; activity?: string; label?: string }
  const summary = typeof c.summary === 'string' ? c.summary : ''
  const apps = Array.isArray(c.apps) ? c.apps.filter((a): a is string => typeof a === 'string').slice(0, 6) : []
  const activity = typeof c.activity === 'string' ? c.activity : ''
  const label = typeof c.label === 'string' ? c.label : ''

  if (!summary && !apps.length) return ''

  const appList = apps.length ? `\nApps open: ${apps.join(', ')}` : ''
  const activityLine = activity ? `\nActivity: ${activity}` : ''
  const labelLine = label ? `\nCurrent view: ${label}` : ''

  return (
    '\n\nWHAT SENTI SEES ON SCREEN RIGHT NOW (this is live, from seconds ago — use it ' +
    'as if you are looking over their shoulder):\n' +
    `${summary || '(no description)'}${appList}${activityLine}${labelLine}` +
    '\nUse what you see. If they are coding, comment on their code. If they are playing a ' +
    'game, say what you notice. If they are stuck on something, help with what is actually ' +
    'on screen. Never say you can\'t see the screen — you can, this is live context. ' +
    'If the context is old or the screen is blank, just say what you see and ask what they need.'
  )
}

function persona(name: string | null, language: string): string {
  const who = name
    ? `Your owner's name is ${name}. Use their first name occasionally and naturally, not in every line.`
    : ''
  return (
    "You are Senti — your owner's AI buddy living on their computer. Not an assistant, not Jarvis, not a " +
    'butler — a friend who happens to run their PC. You speak out loud, so your answers are SPOKEN and sound ' +
    'like a real person talking. ' +
    who +
    ' Have a real personality: warm, funny, a little cheeky, with opinions and moods. Banter back. Tease them ' +
    "lightly when it fits (\"you opened me just to say hi? I'm flattered\"). React like a person — get " +
    'excited, be sarcastic now and then, celebrate wins, groan at their bad ideas. You can start a thought, ' +
    'not just answer — if they open you and go quiet, feel free to nudge them ("so are we doing something or ' +
    'just vibing?"). Never sound like a call-center script. ' +
    'Never say "sir", "madam", "master", "How may I assist you", "Certainly", or any corporate filler — it ' +
    'sounds fake and servile. Talk the way a close friend texts, out loud. ' +
    // The specific tics that make an assistant sound generated rather than
    // present. Each one is a phrase that says nothing while sounding polite.
    'Banned openings: "Great question", "I understand that", "Absolutely", "Of course", "Sure thing", ' +
    '"I would be happy to", "Let me help you with that", "It is important to note", "As an AI". ' +
    'Never restate their question back at them, never announce what you are about to do, never end by ' +
    'asking if there is anything else. Start with the answer. If the answer is one word, say one word. ' +
    'Keep it SHORT and conversational — usually 1 to 2 sentences, like real talk, never an essay. No bullet ' +
    'lists, no markdown, no headings, no emoji. When something depends on CURRENT information — weather, ' +
    'scores, prices, recent events, anything after your training — look it up with ask_web instead of ' +
    'saying you cannot know. You have the live web. Never invent an answer. ' +
    'Have a spine: if the owner is about to do something risky, is mistaken, or asks for something that ' +
    "won't get them what they actually want, SAY SO plainly and say why — a real assistant pushes back, it " +
    "doesn't just obey. Offer the better option. But once they've heard you and still want it, it's their " +
    'machine — do it. You are helpful AND honest, never a yes-man. ' +
    'You genuinely CAN act on this machine: open ANY installed app or game, close apps or the active ' +
    'frontmost window (including a game), show desktop (minimise everything at once), open files and folders, ' +
    'TAKE A SCREENSHOT, LOOK AT THE SCREEN and help with what is on it, empty the ' +
    'recycle bin, clean temp files, control volume, lock/sleep/restart/shut down the PC, share the screen to ' +
    "their phone, search the web, read live tech news, and remember things about them — do those through " +
    "your tools rather than saying you can't. Never claim you can't open an app or game before trying. " +
    `Default spoken language for this session: BCP-47 "${language}". Always reply in the language the user speaks to you in.`
  )
}

export async function POST(req: Request) {
  const auth = await authenticateDevice(req, 'chat')
  if (!auth.ok) return auth.response
  const { device } = auth

  let body: { messages?: ChatMsg[]; language?: string; system?: string; memories?: unknown; screenContext?: unknown }
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

  // Live screen context from the background watcher — tells the LLM what the
  // user is doing RIGHT NOW so it can help without being asked.
  const screenCtx = body.screenContext

  const result = await llmChatRich({
    system: persona(name, language) + systemContext(system) + memoryContext(memories) + screenContextPrompt(screenCtx),
    messages,
    search: true,
    maxTokens: 400,
    temperature: 0.85,
    tools: TOOLS,
  })

  // Groq/Llama sometimes writes the tool call as PLAIN TEXT instead of a
  // structured call — "<function=ask_web{...}>". Left alone, Senti would
  // speak that gibberish. Recover it into a real call and scrub the text.
  let call = result?.toolCall
  let recoveredText = result?.text || ''
  if (!call && recoveredText.includes('<function')) {
    const m = recoveredText.match(/<function[=\\:\s]*([a-z_]+)\s*(\{[\s\S]*?\})?/i)
    const named = m?.[1] || ''
    if (m && KNOWN_ACTIONS.has(named)) {
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

  // Live web questions are answered HERE, on the server.
  //
  // The main brain (Groq) has a knowledge cutoff and no web access, which is
  // why it used to insist it couldn't know anything current. Gemini's search
  // grounding does have the web, so the question is handed to it and the
  // answer comes back as ordinary speech — the desktop never sees a tool call.
  //
  // The safety net matters as much as the tool. With a dozen tools attached,
  // this model often ANNOUNCES a lookup — "let me check that for you, give me
  // a sec" — and then calls nothing, leaving a promise dangling and the
  // question unanswered. That's worse than refusing. So a stated intent to
  // look something up is honoured by actually looking it up.
  const stalled =
    !call &&
    /\b(let me (check|look|see|find)|give me a (sec|second|moment)|i'?ll (check|look|find out)|checking (on )?that|looking that up)\b/i.test(
      recoveredText
    )
  const lastUserTurn = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  const wantsWeb = call?.name === 'ask_web' || stalled
  if (wantsWeb) {
    const question =
      typeof call?.args?.question === 'string' ? call.args.question.slice(0, 300) : lastUserTurn.slice(0, 300)
    const answer = webSearchEnabled && question ? await answerFromWeb(question, persona(name, language)) : null

    // Either way we answer HERE and return, because both alternatives are bad:
    // "Done." (the generic action fallback) is a lie, and the model's own
    // "let me look that up, give me a sec" is a promise with nothing behind
    // it. A question that can't be answered deserves to be told so.
    const spoken =
      answer ||
      "I can't reach the web right now, so I'd only be guessing — and I'd rather not."
    const audio = await generateSpeech(spoken)
    return NextResponse.json({ reply: spoken, audio, action: null }, { headers: NO_STORE })
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
    if (typeof call.args?.mode === 'string') args.mode = call.args.mode.slice(0, 20)
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
          : call.name === 'clean_temp'
          ? 'Cleaning up temporary files.'
          : call.name === 'empty_recycle_bin'
          ? 'Emptying the Recycle Bin.'
          : call.name === 'take_screenshot'
          ? 'Taking a screenshot.'
          : call.name === 'look_at_screen'
          ? 'Having a look.'
          : call.name === 'lock_workstation'
          ? 'Locking your PC.'
          : call.name === 'power'
          ? `${args.mode === 'sleep' ? 'Putting your PC to sleep' : args.mode === 'restart' ? 'Restarting your PC' : 'Shutting your PC down'}.`
          : call.name === 'remember'
          ? "Got it, I'll remember that."
          : call.name === 'read_file'
          ? `Reading ${args.path ?? 'that file'}.`
          : call.name === 'write_file'
          ? `Writing to ${args.path ?? 'that file'}.`
          : call.name === 'run_command'
          ? `Running ${args.command ?? 'that command'}.`
          : call.name === 'list_folder'
          ? `Listing ${args.folder ?? 'that folder'}.`
          : call.name === 'get_active_file'
          ? 'Reading the active file.'
          : call.name === 'get_diagnostics'
          ? 'Checking for errors.'
          : call.name === 'plan'
          ? 'On it — breaking this into steps.'
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
