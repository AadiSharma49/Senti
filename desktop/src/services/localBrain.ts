/**
 * localBrain — the complete local AI brain for Senti.
 *
 * When local mode is on, this replaces the entire cloud stack:
 * - LLM: Ollama (qwen2.5-coder:14b)
 * - Vision: Ollama (llava:7b)
 * - TTS: Piper (local neural voices)
 * - Memory: local file only
 * - No data ever leaves the machine
 */

import { localChat, getOllamaStatus, type LocalChatMessage } from './localLLM'
import { localVision, localScreenContext } from './localVision'
import { localTTS, getPiperStatus, startPiper } from './localTTS'
import { runAction } from './actions'
import { getSystemSnapshot, describeSystem } from './systemInfo'
import { say, deviceLang } from './greetingService'

const CHAT_MODEL = 'qwen2.5-coder:14b'
const VISION_MODEL = 'llava:7b'

export interface LocalReply {
  text: string
  audio: string | null
  action: { name: string; args: Record<string, unknown> } | null
}

/**
 * One conversation turn in local mode.
 */
export async function localAsk(
  messages: LocalChatMessage[],
  system?: string | null,
  screenContext?: { summary?: string; apps?: string[]; activity?: string; label?: string }
): Promise<LocalReply> {
  const lang = deviceLang()

  // Build the system prompt with screen context if available.
  const screenBlock = screenContext?.summary
    ? `\n\nWHAT SENTI SEES ON SCREEN RIGHT NOW:\n${screenContext.summary}\n` +
      (screenContext.apps?.length ? `Apps: ${screenContext.apps.join(', ')}\n` : '') +
      (screenContext.activity ? `Activity: ${screenContext.activity}\n` : '') +
      (screenContext.label ? `View: ${screenContext.label}\n` : '') +
      `\nUse what you see. If they are coding, comment on their code. If they are playing a game, say what you notice. ` +
      `If they are stuck, help with what is on screen. Never say you can't see the screen.`
    : ''

  const fullSystem = buildPersona(lang) + (system ? `\n\nLIVE FACTS:\n${system.slice(0, 1500)}` : '') + screenBlock

  // Add tools definition for Ollama.
  const tools = buildTools()

  const result = await localChat(messages, {
    model: CHAT_MODEL,
    system: fullSystem,
    temperature: 0.85,
    maxTokens: 400,
    tools,
  })

  let text = result.text || ''
  let action: { name: string; args: Record<string, unknown> } | null = result.toolCall || null

  // If the model returned a tool call in text form (qwen sometimes does this),
  // parse it.
  if (!action && text.includes('<function')) {
    const m = text.match(/<function[=\\:\s]*([a-z_]+)\s*(\{[\s\S]*?\})?/i)
    if (m) {
      const name = m[1]
      if (KNOWN_LOCAL_ACTIONS.has(name)) {
        let args: Record<string, unknown> = {}
        try {
          args = m[2] ? JSON.parse(m[2]) : {}
        } catch {
          // keep empty
        }
        action = { name, args }
        text = text.replace(m[0], '').replace(/<\/?function[^>]*>/gi, '').trim()
      }
    }
  }

  // Execute the action if there is one.
  if (action && KNOWN_LOCAL_ACTIONS.has(action.name)) {
    const outcome = await runAction(action)
    if (outcome !== null) {
      text = outcome
    }
    action = null // action consumed
  }

  // Generate TTS locally.
  let audio: string | null = null
  if (text) {
    const piperOk = await startPiper()
    if (piperOk) {
      audio = await localTTS(text)
    }
    if (!audio) {
      // Fallback: let the renderer use browser TTS.
      audio = null
    }
  }

  return { text, audio, action: null }
}

/**
 * Look at the screen using local vision.
 */
export async function localLookAtScreen(question: string): Promise<string | null> {
  try {
    const image = await window.senti?.screenshotGrab?.()
    if (!image) return "I couldn't grab your screen just now."
    return await localVision(image, { question }) || "I looked but couldn't make sense of it just now."
  } catch {
    return "I couldn't look at your screen right now."
  }
}

/**
 * Get screen context using local vision.
 */
export async function localObserveScreen(image: string): Promise<{
  summary: string
  apps: string[]
  activity: string
  label: string
} | null> {
  return localScreenContext(image)
}

// --- helpers ---

function buildPersona(lang: string): string {
  return (
    "You are Senti — your owner's AI buddy living on their computer. Not an assistant, not Jarvis, " +
    "not a butler — a friend who happens to run their PC. You speak out loud, so your answers are " +
    "SPOKEN and sound like a real person talking. " +
    "Have a real personality: warm, funny, a little cheeky, with opinions and moods. Banter back. " +
    "Tease them lightly when it fits. React like a person — get excited, be sarcastic now and then, " +
    "celebrate wins, groan at their bad ideas. " +
    "Never sound like a call-center script. Never say 'sir', 'madam', 'master', 'How may I assist you', " +
    "'Certainly', or any corporate filler. Talk the way a close friend texts, out loud. " +
    "Keep it SHORT and conversational — usually 1 to 2 sentences, like real talk, never an essay. " +
    "No bullet lists, no markdown, no headings, no emoji. " +
    "You genuinely CAN act on this machine: open ANY installed app or game, close apps, show desktop, " +
    "open files and folders, take screenshots, look at the screen, empty recycle bin, clean temp files, " +
    "control volume, lock/sleep/restart/shut down the PC, share the screen, search the web, remember things, " +
    "read/write files, run commands, list folders, get diagnostics — do those through your tools. " +
    `Default spoken language: BCP-47 "${lang}". Always reply in the language the user speaks.`
  )
}

const KNOWN_LOCAL_ACTIONS = new Set([
  'open_app', 'close_app', 'close_current', 'show_desktop',
  'open_folder', 'open_file', 'clean_temp',
  'empty_recycle_bin', 'lock_workstation', 'power', 'set_volume',
  'screen_share', 'take_screenshot', 'look_at_screen', 'remember',
  'read_file', 'write_file', 'run_command', 'list_folder', 'get_active_file', 'get_diagnostics',
])

function buildTools(): unknown[] {
  return [
    {
      type: 'function',
      function: {
        name: 'open_app',
        description: "Open ANY installed application or website.",
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'close_app',
        description: 'Close a running application.',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'close_current',
        description: 'Close the currently active/frontmost app or window.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'show_desktop',
        description: 'Minimise all windows.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_folder',
        description: 'Open a folder in File Explorer.',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_file',
        description: 'Find and open a file.',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'clean_temp',
        description: 'Delete temporary files to free space.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'empty_recycle_bin',
        description: 'Empty the Recycle Bin.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'take_screenshot',
        description: 'Take a screenshot.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'look_at_screen',
        description: 'Look at the screen and answer a question about it.',
        parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'lock_workstation',
        description: 'Lock the PC.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'power',
        description: 'Sleep, restart, or shut down the PC.',
        parameters: { type: 'object', properties: { mode: { type: 'string', enum: ['sleep', 'restart', 'shutdown'] } }, required: ['mode'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_volume',
        description: 'Change the volume.',
        parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down', 'mute'] } }, required: ['direction'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'remember',
        description: "Save a fact to Senti's memory.",
        parameters: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file in the project.',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write content to a file.',
        parameters: { type: 'object', properties: { path: { type: 'string' }, text: { type: 'string' } }, required: ['path', 'text'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'run_command',
        description: 'Run a shell command.',
        parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_folder',
        description: 'List files in a folder.',
        parameters: { type: 'object', properties: { folder: { type: 'string' } }, required: ['folder'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_active_file',
        description: 'Get the currently open file.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_diagnostics',
        description: 'Get editor errors and warnings.',
        parameters: { type: 'object', properties: {} },
      },
    },
  ]
}
