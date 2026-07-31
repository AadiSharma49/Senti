import { AudioCapture } from './audioCapture'
import type { AudioLevel } from '../types/audio'

/**
 * VoiceActivityDetector - lightweight VAD wrapper around AudioCapture.
 *
 * Subscribes to AudioCapture's frame stream and classifies as
 * 'silent' or 'speaking' based on RMS energy thresholds.
 *
 * No authentication logic. No lock screen changes.
 */

// ─── Tunable constants ───────────────────────────────────────────
//
// The threshold ADAPTS to the microphone rather than assuming a loud one.
//
// A fixed cutoff was the bug behind "it only heard one word of my sentence":
// on a quiet mic (laptop built-ins, anything with low gain) only the loudest
// syllable of a sentence clears a fixed line, so the recorder starts late,
// stops early, and hands Whisper a fragment. The transcription is then
// perfectly accurate — of the wrong audio.
//
// So we track the quietest recent level as a noise floor and put the threshold
// a multiple above it. A quiet room lowers the bar; a noisy one raises it.

/** Never go below this, or the recorder triggers on room hum. */
const MIN_THRESHOLD = 0.004
/** Never go above this, however loud the room — speech must still get through. */
const MAX_THRESHOLD = 0.05
/** Speech is this much louder than the noise floor. */
const FLOOR_MULTIPLIER = 3.5
/** How quickly the floor follows the room. Slow, so speech can't raise it. */
const FLOOR_RISE = 0.002
const FLOOR_FALL = 0.05

// Consecutive frames above threshold required to transition to 'speaking'.
// At 50 ms/frame this is ~100 ms — low enough to catch a sentence's first
// syllable, which is exactly what a late trigger clips off.
const SPEECH_CONSECUTIVE = 2

// Consecutive frames below threshold required to return to 'silent'.
// At 50 ms/frame this is ~600 ms hangover, so an ordinary pause between words
// doesn't end the utterance. This is the DEFAULT; the assistant passes a
// longer one so a thinking pause mid-sentence doesn't end your turn.
const SILENCE_CONSECUTIVE = 12
// ─────────────────────────────────────────────────────────────────

export type VADState = 'silent' | 'speaking'

export interface VADOptions {
  /** Frames of silence (~50ms each) before the turn ends. Higher = more patient. */
  silenceHangoverFrames?: number
}

export class VoiceActivityDetector {
  private capture: AudioCapture | null = null
  private state: VADState = 'silent'
  private silenceCount = 0
  private speechCount = 0
  /** Rolling estimate of room noise; the threshold rides above it. */
  private noiseFloor = MIN_THRESHOLD
  private subscribers = new Set<(state: VADState) => void>()
  private unsubFrame: (() => void) | null = null
  private silenceNeeded: number

  constructor(options: VADOptions = {}) {
    this.silenceNeeded = options.silenceHangoverFrames ?? SILENCE_CONSECUTIVE
  }

  getState(): VADState {
    return this.state
  }

  onStateChange(callback: (state: VADState) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notify() {
    this.subscribers.forEach((cb) => cb(this.state))
  }

  start(capture: AudioCapture): void {
    if (this.capture) return
    this.capture = capture
    this.unsubFrame = capture.subscribe((_frame, level) => {
      this.processLevel(level)
    })
  }

  stop(): void {
    this.unsubFrame?.()
    this.unsubFrame = null
    this.capture = null
    this.setState('silent')
    this.silenceCount = 0
    this.speechCount = 0
    // Re-learn the room next time; the mic may well be a different one.
    this.noiseFloor = MIN_THRESHOLD
  }

  /** The current speech cutoff, tracking the room. Exposed for diagnostics. */
  getThreshold(): number {
    return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, this.noiseFloor * FLOOR_MULTIPLIER))
  }

  private processLevel(level: AudioLevel): void {
    // Track the noise floor, but only WHILE SILENT — letting speech drag the
    // floor up is how an adaptive VAD deafens itself mid-sentence.
    if (this.state === 'silent') {
      const rate = level.rms > this.noiseFloor ? FLOOR_RISE : FLOOR_FALL
      this.noiseFloor += (level.rms - this.noiseFloor) * rate
    }

    const above = level.rms >= this.getThreshold()

    if (this.state === 'silent') {
      if (above) {
        this.speechCount++
        if (this.speechCount >= SPEECH_CONSECUTIVE) {
          this.setState('speaking')
          this.silenceCount = 0
        }
      } else {
        this.speechCount = 0
      }
    } else {
      if (!above) {
        this.silenceCount++
        if (this.silenceCount >= this.silenceNeeded) {
          this.setState('silent')
          this.speechCount = 0
        }
      } else {
        this.silenceCount = 0
      }
    }
  }

  private setState(newState: VADState): void {
    if (this.state !== newState) {
      this.state = newState
      this.notify()
    }
  }
}
