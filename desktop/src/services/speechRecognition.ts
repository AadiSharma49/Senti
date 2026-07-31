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
 * fp32, NOT quantized. onnxruntime's QDQ optimizer rejects the quantized
 * Whisper export ("TransposeDQWeightsForMatMulNBits Missing required scale"),
 * and no session option avoids it — the weights themselves are the problem.
 * fp32 has nothing to rewrite, so the session always builds. See
 * scripts/setup-voice-model.mjs.
 */
const DTYPE = 'fp32'

/** Load the ASR model (idempotent). */
export async function loadSpeechRecognition(): Promise<any> {
  if (asr) return asr
  if (!loadPromise) {
    loadPromise = pipeline('automatic-speech-recognition', MODEL_ID, { dtype: DTYPE })
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
/**
 * Bring a quiet recording up to a usable level before transcribing.
 *
 * Whisper is markedly worse on faint audio — a quiet laptop mic turned "can
 * you hear me" into "My boy can hear me. Bro can hear me." The words were all
 * there, just too soft to resolve. Scaling the whole clip so its loudest peak
 * approaches full scale costs nothing and recovers most of that.
 *
 * Peak normalisation, not compression: every sample is multiplied by the same
 * number, so the shape of the speech is untouched and no noise is invented.
 * Clips that are already loud, or that contain only silence, are left alone.
 */
const TARGET_PEAK = 0.85
/** Below this the clip is silence or a click; amplifying it just raises hiss. */
const MIN_USEFUL_PEAK = 0.005
/** Cap the boost so a near-silent room doesn't become a wall of noise. */
const MAX_GAIN = 12

function normalize(samples: Float32Array): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i])
    if (v > peak) peak = v
  }
  if (peak < MIN_USEFUL_PEAK || peak >= TARGET_PEAK) return samples

  const gain = Math.min(MAX_GAIN, TARGET_PEAK / peak)
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

export async function transcribeRaw(utterance: Utterance): Promise<string> {
  const p = await loadSpeechRecognition()
  const audio = resampleTo(utterance.samples, utterance.sampleRate, ASR_SAMPLE_RATE)
  const out = await p(normalize(audio))
  return typeof out?.text === 'string' ? out.text.trim() : ''
}
