import './transformersEnv'
import { AutoProcessor, AutoModel } from '@huggingface/transformers'
import type { Utterance } from '../types/audio'

/**
 * VoiceEmbeddingEngine - converts an Utterance into a speaker embedding
 * ("voiceprint"): a 256-dim vector describing WHO is speaking, not what
 * was said.
 *
 * Model: WeSpeaker ResNet34-LM (ONNX, fp32) running fully on-device via
 * onnxruntime-web WASM. Model + runtime are served from local files
 * (public/models, public/ort — fetched once via `npm run setup:voice`),
 * so no network access is ever needed at runtime.
 *
 * Pure inference. No authentication decisions, no storage, no UI.
 */

const MODEL_ID = 'wespeaker-voxceleb-resnet34-LM'
const MODEL_SAMPLE_RATE = 16000

export type EngineState = 'idle' | 'loading' | 'ready' | 'error'
export type EngineStateCallback = (state: EngineState, error?: string) => void

/** Linear-interpolation resampler; adequate for speech features */
export function resampleTo(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples
  const ratio = fromRate / toRate
  const outLength = Math.floor(samples.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const right = Math.min(left + 1, samples.length - 1)
    const frac = pos - left
    out[i] = samples[left] * (1 - frac) + samples[right] * frac
  }
  return out
}

/** Cosine similarity between two embeddings (-1..1, higher = more similar) */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/** Average multiple embeddings into one profile embedding (L2-normalized) */
export function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  const dim = embeddings[0].length
  const avg = new Float32Array(dim)
  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) avg[i] += e[i]
  }
  let norm = 0
  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length
    norm += avg[i] * avg[i]
  }
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < dim; i++) avg[i] /= norm
  }
  return avg
}

export class VoiceEmbeddingEngine {
  private state: EngineState = 'idle'
  private error: string | null = null
  private processor: any = null
  private model: any = null
  private loadPromise: Promise<void> | null = null
  private stateCallbacks = new Set<EngineStateCallback>()

  getState(): EngineState {
    return this.state
  }

  getError(): string | null {
    return this.error
  }

  onStateChange(callback: EngineStateCallback): () => void {
    this.stateCallbacks.add(callback)
    return () => {
      this.stateCallbacks.delete(callback)
    }
  }

  /** Load the model (idempotent; safe to call multiple times) */
  async load(): Promise<void> {
    if (this.state === 'ready') return
    if (this.loadPromise) return this.loadPromise

    this.setState('loading')
    this.loadPromise = (async () => {
      try {
        this.processor = await AutoProcessor.from_pretrained(MODEL_ID, {})
        this.model = await AutoModel.from_pretrained(MODEL_ID, {
          dtype: 'fp32',
          device: 'wasm',
        })
        this.setState('ready')
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Model load failed'
        this.setState('error')
        this.loadPromise = null
        throw err
      }
    })()
    return this.loadPromise
  }

  /** Compute a speaker embedding (voiceprint) for an utterance */
  async computeEmbedding(utterance: Utterance): Promise<Float32Array> {
    if (this.state !== 'ready') {
      await this.load()
    }

    const audio = resampleTo(utterance.samples, utterance.sampleRate, MODEL_SAMPLE_RATE)
    const inputs = await this.processor(audio)
    const output = await this.model(inputs)

    // WeSpeaker outputs a single [1, 256] tensor named `last_hidden_state`
    const tensor = output.last_hidden_state ?? output.embeddings ?? output[Object.keys(output)[0]]
    const embedding = new Float32Array(tensor.data as Float32Array)

    // L2-normalize so cosine similarity is a pure angle comparison
    let norm = 0
    for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i]
    norm = Math.sqrt(norm)
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) embedding[i] /= norm
    }
    return embedding
  }

  private setState(newState: EngineState): void {
    this.state = newState
    this.stateCallbacks.forEach((cb) => cb(this.state, this.error ?? undefined))
  }
}

/** Shared engine instance — the model is heavy, load it exactly once */
export const voiceEmbeddingEngine = new VoiceEmbeddingEngine()
