import { useDeviceStore } from '../state/deviceStore'
import { useVoiceProfileStore } from '../state/voiceProfileStore'

/**
 * greetingService - fetches the AI greeting to play on unlock and speaks it
 * aloud with the browser's built-in text-to-speech, choosing the best
 * available natural voice (a calmer, deeper "assistant" delivery). The
 * greeting is composed server-side (dashboard) in the device's language when
 * linked; otherwise a varied local greeting is used. No API key on the device.
 */
const GREETING_URL = 'http://localhost:3000/api/device/greeting'

export function deviceLang(): string {
  try {
    return navigator.language || 'en-US'
  } catch {
    return 'en-US'
  }
}

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

/** Get a greeting: from the account (in the device's language) if linked, else local. */
export async function fetchGreeting(lang: string): Promise<string> {
  const token = useDeviceStore.getState().token
  if (!token) return localGreeting()
  try {
    const res = await fetch(`${GREETING_URL}?lang=${encodeURIComponent(lang)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return localGreeting()
    const data = await res.json()
    return typeof data.greeting === 'string' && data.greeting.trim() ? data.greeting.trim() : localGreeting()
  } catch {
    return localGreeting()
  }
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

/** Speak text aloud in the given language. Resolves when speech ends (or times out). */
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
