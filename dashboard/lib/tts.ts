/**
 * Human text-to-speech via ElevenLabs. When ELEVENLABS_API_KEY is set, Senti
 * speaks in a real, natural human voice (multilingual). Without a key, the
 * desktop falls back to the browser's built-in voice.
 *
 * Runs server-side only — the key never reaches the desktop; the desktop
 * receives finished audio.
 */
const KEY = process.env.ELEVENLABS_API_KEY
export const humanVoiceEnabled = !!KEY

/**
 * Default: "Chris" — a light, casual, natural male voice (free premade). Other
 * free-plan voices: Will bIHbv24MWmeRgasZH58o, Brian nPczCjzI2devNBz1zQrb,
 * Eric cjVigY5qzO86Huf0OWal, Adam pNInz6obpgDQGcFmaJgB (deep).
 * Note: Voice Library voices need a paid ElevenLabs plan; premade ones are free.
 */
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'iP95p4xoKVk53GoZ742B'

/**
 * Turbo v2.5 — multilingual, and much lower latency than multilingual_v2,
 * which matters for back-and-forth conversation.
 */
const MODEL_ID = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'

/** Generate speech audio for text. Returns a data: URI (audio/mpeg) or null. */
export async function generateSpeech(text: string): Promise<string | null> {
  if (!KEY || !text.trim()) return null
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        // Tuned for a natural, human delivery: some variation (lower stability)
        // and no style exaggeration, which is what makes TTS sound synthetic.
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:audio/mpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
