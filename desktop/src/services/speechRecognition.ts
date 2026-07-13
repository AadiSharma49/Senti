import './transformersEnv'
import { pipeline } from '@huggingface/transformers'
import { resampleTo } from './voiceEmbeddingEngine'
import type { Utterance } from '../types/audio'

/**
 * On-device speech recognition (multilingual Whisper), running fully offline
 * via onnxruntime-web WASM.
 *
 * This is used ONLY by the conversational assistant, to turn what the user
 * says into text. It plays no part in unlocking: unlock is voice-only and
 * checks WHO is speaking (the voiceprint), never WHAT they said. There is no
 * wake phrase or keyword anywhere in the auth path.
 */

// Multilingual Whisper — transcribes speech in any language and auto-detects it.
const MODEL_ID = 'whisper-tiny'
const ASR_SAMPLE_RATE = 16000

let asr: any = null
let loadPromise: Promise<any> | null = null

/** Load the ASR model (idempotent). */
export async function loadSpeechRecognition(): Promise<any> {
  if (asr) return asr
  if (!loadPromise) {
    loadPromise = pipeline('automatic-speech-recognition', MODEL_ID, { dtype: 'q8' })
      .then((p) => {
        asr = p
        return p
      })
      .catch((err) => {
        loadPromise = null
        throw err
      })
  }
  return loadPromise
}

/**
 * Transcribe an utterance to text, preserving the original casing,
 * punctuation and script so questions in any language survive intact.
 */
export async function transcribeRaw(utterance: Utterance): Promise<string> {
  const p = await loadSpeechRecognition()
  const audio = resampleTo(utterance.samples, utterance.sampleRate, ASR_SAMPLE_RATE)
  const out = await p(audio)
  return typeof out?.text === 'string' ? out.text.trim() : ''
}
