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

/**
 * Load configs, tried in order. onnxruntime's graph optimizer rewrites the
 * quantized decoder's MatMulNBits weights and fails on this model
 * ("Missing required scale ... DequantizeLinear"), so we turn optimization
 * off first. The plain configs are fallbacks in case a future ORT fixes it.
 */
const LOAD_CONFIGS: Record<string, unknown>[] = [
  { dtype: 'q8', session_options: { graphOptimizationLevel: 'disabled' } },
  { dtype: 'q8', session_options: { graphOptimizationLevel: 'basic' } },
  { dtype: 'q8' },
]

/** Load the ASR model (idempotent). */
export async function loadSpeechRecognition(): Promise<any> {
  if (asr) return asr
  if (!loadPromise) {
    loadPromise = (async () => {
      let lastErr: unknown = null
      for (const config of LOAD_CONFIGS) {
        try {
          const p = await pipeline('automatic-speech-recognition', MODEL_ID, config as any)
          asr = p
          return p
        } catch (err) {
          lastErr = err
        }
      }
      loadPromise = null
      throw lastErr instanceof Error ? lastErr : new Error('Speech model failed to load')
    })()
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
