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
// RMS energy above this is considered "potential speech".
// 0.02 ≈ -34 dB — a reasonable floor for typical room audio.
const VAD_THRESHOLD = 0.02

// Consecutive frames above threshold required to transition to 'speaking'.
// At 50 ms/frame this is ~150 ms, enough to ignore impulsive noise.
const SPEECH_CONSECUTIVE = 3

// Consecutive frames below threshold required to return to 'silent'.
// At 50 ms/frame this is ~400 ms hangover to avoid chopping off words.
const SILENCE_CONSECUTIVE = 8
// ─────────────────────────────────────────────────────────────────

export type VADState = 'silent' | 'speaking'

export class VoiceActivityDetector {
  private capture: AudioCapture | null = null
  private state: VADState = 'silent'
  private silenceCount = 0
  private speechCount = 0
  private subscribers = new Set<(state: VADState) => void>()
  private unsubFrame: (() => void) | null = null

  constructor() {}

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
  }

  private processLevel(level: AudioLevel): void {
    const above = level.rms >= VAD_THRESHOLD

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
        if (this.silenceCount >= SILENCE_CONSECUTIVE) {
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
