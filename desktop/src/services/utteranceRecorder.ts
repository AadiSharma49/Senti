import { AudioCapture } from './audioCapture'
import { VoiceActivityDetector } from './voiceActivityDetector'
import type { AudioFrame, Utterance } from '../types/audio'

/**
 * UtteranceRecorder - turns the continuous microphone stream into
 * discrete speech segments ("utterances") using the VAD.
 *
 * Flow:
 *   listening -> (VAD: speaking) -> recording -> (VAD: silent) -> emit Utterance
 *
 * A pre-roll ring buffer keeps the frames just before speech was
 * detected, so the start of the first word is not chopped off by the
 * VAD attack time.
 *
 * Downstream consumers: voice enrollment and speaker verification.
 * No authentication logic here - this only produces audio segments.
 */

// ─── Tunable constants ───────────────────────────────────────────
// Frames kept from before speech onset. At ~46ms/frame this is ~280ms,
// covering the VAD attack time (~150ms) plus a safety margin.
const PRE_ROLL_FRAMES = 6

// Utterances shorter than this are discarded as noise blips.
const MIN_UTTERANCE_SEC = 0.3

// Hard cap: recording is finalized even if speech continues. This is the
// DEFAULT (fine for unlock — a short phrase). The assistant passes a much
// longer cap so it doesn't chop off a real question mid-sentence.
const MAX_UTTERANCE_SEC = 6
// ─────────────────────────────────────────────────────────────────

export type UtteranceRecorderState = 'idle' | 'listening' | 'recording'

export type UtteranceCallback = (utterance: Utterance) => void
export type RecorderStateCallback = (state: UtteranceRecorderState) => void

export interface UtteranceRecorderOptions {
  /** Max seconds to record one turn before finalizing (default 6). */
  maxUtteranceSec?: number
  /** Frames of silence before the turn ends (~50ms each; default 8 ≈ 400ms). */
  silenceHangoverFrames?: number
}

export class UtteranceRecorder {
  private capture: AudioCapture | null = null
  private vad: VoiceActivityDetector | null = null
  private state: UtteranceRecorderState = 'idle'
  private maxSec: number
  private silenceHangoverFrames?: number

  constructor(options: UtteranceRecorderOptions = {}) {
    this.maxSec = options.maxUtteranceSec ?? MAX_UTTERANCE_SEC
    this.silenceHangoverFrames = options.silenceHangoverFrames
  }

  private preRoll: AudioFrame[] = []
  private recordedFrames: AudioFrame[] = []
  private recordedDuration = 0

  private utteranceCallbacks = new Set<UtteranceCallback>()
  private stateCallbacks = new Set<RecorderStateCallback>()

  private unsubFrame: (() => void) | null = null
  private unsubVad: (() => void) | null = null

  getState(): UtteranceRecorderState {
    return this.state
  }

  onUtterance(callback: UtteranceCallback): () => void {
    this.utteranceCallbacks.add(callback)
    return () => {
      this.utteranceCallbacks.delete(callback)
    }
  }

  onStateChange(callback: RecorderStateCallback): () => void {
    this.stateCallbacks.add(callback)
    return () => {
      this.stateCallbacks.delete(callback)
    }
  }

  /** Begin listening for utterances on an active AudioCapture */
  start(capture: AudioCapture): void {
    if (this.capture) return
    this.capture = capture

    this.vad = new VoiceActivityDetector({ silenceHangoverFrames: this.silenceHangoverFrames })
    this.unsubVad = this.vad.onStateChange((vadState) => {
      if (vadState === 'speaking') this.beginRecording()
      else this.finalizeRecording()
    })
    this.vad.start(capture)

    this.unsubFrame = capture.subscribe((frame) => this.processFrame(frame))
    this.setState('listening')
  }

  /** Stop listening; any in-progress recording is discarded */
  stop(): void {
    this.unsubFrame?.()
    this.unsubFrame = null
    this.unsubVad?.()
    this.unsubVad = null
    this.vad?.stop()
    this.vad = null
    this.capture = null
    this.preRoll = []
    this.recordedFrames = []
    this.recordedDuration = 0
    this.setState('idle')
  }

  // --- Private ------------------------------------------------------

  private processFrame(frame: AudioFrame): void {
    if (this.state === 'recording') {
      this.recordedFrames.push(frame)
      this.recordedDuration += frame.duration
      if (this.recordedDuration >= this.maxSec) {
        this.finalizeRecording()
      }
    } else if (this.state === 'listening') {
      this.preRoll.push(frame)
      if (this.preRoll.length > PRE_ROLL_FRAMES) {
        this.preRoll.shift()
      }
    }
  }

  private beginRecording(): void {
    if (this.state !== 'listening') return
    this.recordedFrames = [...this.preRoll]
    this.recordedDuration = this.recordedFrames.reduce((sum, f) => sum + f.duration, 0)
    this.preRoll = []
    this.setState('recording')
  }

  private finalizeRecording(): void {
    if (this.state !== 'recording') return

    const frames = this.recordedFrames
    this.recordedFrames = []
    this.recordedDuration = 0
    this.setState('listening')

    if (frames.length === 0) return

    const totalSamples = frames.reduce((sum, f) => sum + f.samples.length, 0)
    const sampleRate = frames[0].sampleRate
    const duration = totalSamples / sampleRate
    if (duration < MIN_UTTERANCE_SEC) return

    const samples = new Float32Array(totalSamples)
    let offset = 0
    for (const f of frames) {
      samples.set(f.samples, offset)
      offset += f.samples.length
    }

    const utterance: Utterance = {
      samples,
      sampleRate,
      duration,
      timestamp: frames[0].timestamp,
    }

    this.utteranceCallbacks.forEach((cb) => {
      try {
        cb(utterance)
      } catch {
        // Silently ignore subscriber errors
      }
    })
  }

  private setState(newState: UtteranceRecorderState): void {
    if (this.state !== newState) {
      this.state = newState
      this.stateCallbacks.forEach((cb) => cb(this.state))
    }
  }
}
