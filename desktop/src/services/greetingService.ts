import { useVoiceProfileStore } from '../state/voiceProfileStore'
import { api } from './api'

/**
 * greetingService - fetches the AI greeting to play on unlock and speaks it
 * aloud with the browser's built-in text-to-speech, choosing the best
 * available natural voice (a calmer, deeper "assistant" delivery). The
 * greeting is composed server-side (dashboard) in the device's language when
 * linked; otherwise a varied local greeting is used. No API key on the device.
 */
const GREETING_PATH = '/api/device/greeting'

const LANG_KEY = 'senti:language'

/**
 * The language Senti speaks and listens in.
 *
 * A saved choice wins over the OS locale, because the two often disagree:
 * plenty of people run Windows in English but would rather be spoken to in
 * their own language. Empty means "follow the system".
 */
export function deviceLang(): string {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved) return saved
  } catch {
    // storage unavailable — fall through to the system locale
  }
  try {
    return navigator.language || 'en-US'
  } catch {
    return 'en-US'
  }
}

export function savedLang(): string {
  try {
    return localStorage.getItem(LANG_KEY) || ''
  } catch {
    return ''
  }
}

export function setLang(tag: string): void {
  try {
    if (tag) localStorage.setItem(LANG_KEY, tag)
    else localStorage.removeItem(LANG_KEY)
  } catch {
    // ignore — the system locale still applies
  }
}

/** Offered in the Control Center. Whisper handles all of these on-device. */
export const LANGUAGES: { tag: string; label: string }[] = [
  { tag: '', label: 'Follow system' },
  { tag: 'en-US', label: 'English' },
  { tag: 'hi-IN', label: 'हिन्दी / Hindi' },
  { tag: 'es-ES', label: 'Español' },
  { tag: 'fr-FR', label: 'Français' },
  { tag: 'de-DE', label: 'Deutsch' },
  { tag: 'pt-BR', label: 'Português' },
  { tag: 'ja-JP', label: '日本語' },
  { tag: 'zh-CN', label: '中文' },
  { tag: 'ar-SA', label: 'العربية' },
  { tag: 'ru-RU', label: 'Русский' },
]

function timeOfDay(): string {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}

function localGreeting(): string {
  const cap = `Good ${timeOfDay()}`
  const options = [
    `${cap}. Systems are green and ready.`,
    `${cap}. Welcome back — everything's secure.`,
    `${cap}. You're verified. Let's get to work.`,
    `Welcome back. All systems nominal.`,
    `${cap}. Good to hear your voice again.`,
  ]
  return options[Math.floor(Math.random() * options.length)]
}

export interface Greeting {
  text: string
  /** data: URI of human-voice audio (ElevenLabs), or null → use browser TTS. */
  audio: string | null
}

/** Get a greeting: from the account (in the device's language) if linked, else local. */
export async function fetchGreeting(lang: string): Promise<Greeting> {
  const res = await api<{ greeting?: string; audio?: string }>(
    `${GREETING_PATH}?lang=${encodeURIComponent(lang)}`
  )
  // Unlinked, offline, or rate limited — never block an unlock on the network.
  if (!res.ok) return { text: localGreeting(), audio: null }

  const data = res.data || {}
  const text =
    typeof data.greeting === 'string' && data.greeting.trim() ? data.greeting.trim() : localGreeting()
  const audio = typeof data.audio === 'string' && data.audio.startsWith('data:audio') ? data.audio : null
  return { text, audio }
}

/** Play pre-generated human-voice audio. Resolves when it ends (or times out). */
function playAudio(dataUri: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(dataUri)
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      audio.onended = finish
      audio.onerror = finish
      audio.play().catch(finish)
      setTimeout(finish, 12000)
    } catch {
      resolve()
    }
  })
}

// --- Voice selection ------------------------------------------------

let cachedVoices: SpeechSynthesisVoice[] | null = null

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) return resolve([])
    const now = synth.getVoices()
    if (now.length) return resolve(now)
    // Voices load asynchronously on first use
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', finish, { once: true })
    setTimeout(finish, 1500)
  })
}

/** Score voices to prefer natural/neural, assistant-like ones matching the language. */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const base = lang.split('-')[0].toLowerCase()
  // Preferred voice names for a calm, deep "Jarvis" feel (Windows/Edge neural).
  const preferredNames = ['guy', 'ryan', 'davis', 'tony', 'christopher', 'brian', 'george', 'david']

  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0
    const name = v.name.toLowerCase()
    const vlang = v.lang.toLowerCase()
    if (vlang.startsWith(lang.toLowerCase())) s += 100
    else if (vlang.startsWith(base)) s += 60
    if (/natural|neural|online/.test(name)) s += 40
    if (preferredNames.some((n) => name.includes(n))) s += 25
    if (!v.localService) s += 5 // cloud voices are usually higher quality
    return s
  }

  const ranked = [...voices].sort((a, b) => score(b) - score(a))
  // Only accept if it at least matches the language family; else null (fallback to default).
  const top = ranked[0]
  return top && top.lang.toLowerCase().startsWith(base) ? top : ranked.find((v) => v.lang.toLowerCase().startsWith('en')) || top
}

/**
 * Speak a greeting: play the human-voice audio when available, otherwise
 * fall back to the browser's built-in voice.
 */
export async function say(greeting: Greeting, lang: string): Promise<void> {
  if (greeting.audio) {
    await playAudio(greeting.audio)
    return
  }
  await speak(greeting.text, lang)
}

/** Speak text aloud with the browser voice. Resolves when speech ends (or times out). */
export async function speak(text: string, lang: string): Promise<void> {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synth) return
  return new Promise(async (resolve) => {
    try {
      if (!cachedVoices) cachedVoices = await loadVoices()
      synth.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      const voice = pickVoice(cachedVoices, lang)
      if (voice) utter.voice = voice
      utter.lang = voice?.lang || lang
      utter.rate = 0.96 // slightly slower — measured, assistant-like
      utter.pitch = 0.9 // a touch deeper for gravitas
      utter.volume = 1
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      utter.onend = finish
      utter.onerror = finish
      synth.speak(utter)
      setTimeout(finish, 9000)
    } catch {
      resolve()
    }
  })
}

export function hasProfile(): boolean {
  return !!useVoiceProfileStore.getState().profile
}
