import { useDeviceStore } from '../state/deviceStore'
import { useVoiceProfileStore } from '../state/voiceProfileStore'

/**
 * greetingService - fetches the AI greeting to play on unlock and speaks it
 * aloud with the browser's built-in text-to-speech. The greeting is composed
 * server-side (dashboard) when the device is linked; otherwise a varied local
 * greeting is used so it works offline. No API key ever lives on the device.
 */
const GREETING_URL = 'http://localhost:3000/api/device/greeting'

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

/** Get a greeting: from the account if linked, else a local varied one. */
export async function fetchGreeting(): Promise<string> {
  const token = useDeviceStore.getState().token
  if (!token) return localGreeting()
  try {
    const res = await fetch(GREETING_URL, {
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

/** Speak text aloud. Resolves when speech ends (or after a safety timeout). */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis
      if (!synth) return resolve()
      synth.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.02
      utter.pitch = 1
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      utter.onend = finish
      utter.onerror = finish
      synth.speak(utter)
      // Safety net: never hang the unlock flow on TTS
      setTimeout(finish, 8000)
    } catch {
      resolve()
    }
  })
}

/** Enrollment-independent: only greet by voice profile presence is not required. */
export function hasProfile(): boolean {
  return !!useVoiceProfileStore.getState().profile
}
