/**
 * Human text-to-speech via ElevenLabs. When ELEVENLABS_API_KEY is set,
 * the unlock greeting is spoken in a real, natural human voice (multilingual).
 * Without a key, the desktop falls back to the browser's built-in voice.
 *
 * Runs server-side only — the key never reaches the desktop; the desktop
 * receives finished audio.
 */
const KEY = process.env.ELEVENLABS_API_KEY
export const humanVoiceEnabled = !!KEY

// Default: "Adam" — a calm, deep male voice. Override with ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'

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
        // Multilingual model so any language sounds natural.
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:audio/mpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
