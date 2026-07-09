import './transformersEnv'
import { pipeline } from '@huggingface/transformers'
import { resampleTo } from './voiceEmbeddingEngine'
import type { Utterance } from '../types/audio'

/**
 * On-device speech recognition (Whisper tiny.en) — transcribes an
 * utterance to text so Senti can verify WHAT was said (the wake phrase),
 * in addition to WHO said it (the voiceprint).
 *
 * Runs fully offline via onnxruntime-web WASM. Pure transcription — no
 * auth decisions here.
 */

// Multilingual Whisper — transcribes wake phrases in any language and
// auto-detects the language spoken.
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

/** Transcribe an utterance to normalized text. */
export async function transcribe(utterance: Utterance): Promise<string> {
  const p = await loadSpeechRecognition()
  const audio = resampleTo(utterance.samples, utterance.sampleRate, ASR_SAMPLE_RATE)
  const out = await p(audio)
  return normalizePhrase(typeof out?.text === 'string' ? out.text : '')
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Word-level Levenshtein distance. */
function wordEditDistance(a: string[], b: string[]): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

/**
 * Similarity (0..1) between two phrases at the word level. Tolerant of
 * minor ASR errors (e.g. one wrong/missing word in a short phrase).
 */
export function phraseSimilarity(a: string, b: string): number {
  const wa = normalizePhrase(a).split(' ').filter(Boolean)
  const wb = normalizePhrase(b).split(' ').filter(Boolean)
  if (wa.length === 0 || wb.length === 0) return 0
  const dist = wordEditDistance(wa, wb)
  return 1 - dist / Math.max(wa.length, wb.length)
}
