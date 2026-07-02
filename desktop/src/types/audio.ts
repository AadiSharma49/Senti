/**
 * Audio types for Senti authentication pipeline.
 * Shared across Voice Engine, Clap Engine, and future Wake Word.
 * No business logic - only type definitions.
 */

/** Current state of the microphone capture system */
export type AudioCaptureState = 'idle' | 'requesting' | 'active' | 'error'

/** Audio level measurement from AnalyserNode */
export interface AudioLevel {
  /** Root Mean Square volume (0.0 - 1.0) */
  rms: number
  /** Peak sample value (0.0 - 1.0) */
  peak: number
  /** Clipped flag if samples hit 1.0 */
  clipped: boolean
}

/** A single frame of raw PCM audio data */
export interface AudioFrame {
  /** Float32 PCM samples (-1.0 to 1.0) */
  samples: Float32Array
  /** Sample rate in Hz (e.g. 44100, 16000) */
  sampleRate: number
  /** Number of channels (1 = mono) */
  channels: number
  /** Timestamp in milliseconds (performance.now) */
  timestamp: number
  /** Duration of this frame in seconds */
  duration: number
}

/** Sliding window buffer of audio frames */
export interface AudioBuffer {
  /** All frames currently in the buffer */
  frames: AudioFrame[]
  /** Total duration of buffered audio in seconds */
  totalDuration: number
  /** Maximum number of frames before oldest is dropped */
  maxFrames: number
}

/** Microphone device and permission status */
export interface MicrophoneStatus {
  /** Current capture state */
  state: AudioCaptureState
  /** Human-readable error message if state === 'error' */
  error: string | null
  /** Label of the active microphone device */
  deviceLabel: string | null
  /** Sample rate of the active audio context */
  sampleRate: number | null
}

/** A complete captured speech segment (contiguous PCM) */
export interface Utterance {
  /** Gapless Float32 PCM samples (-1.0 to 1.0) of the full segment */
  samples: Float32Array
  /** Sample rate in Hz */
  sampleRate: number
  /** Duration of the utterance in seconds */
  duration: number
  /** Timestamp (performance.now) when the utterance started */
  timestamp: number
}

/** Callback type for audio frame subscribers */
export type AudioFrameCallback = (frame: AudioFrame, level: AudioLevel) => void

/** Callback type for status change subscribers */
export type AudioStatusCallback = (status: MicrophoneStatus) => void

/** Configuration for AudioCapture service */
export interface AudioCaptureConfig {
  /** Target sample rate (default: 44100) */
  sampleRate?: number
  /** FFT size for AnalyserNode (default: 2048) */
  fftSize?: number
  /** Buffer duration in seconds per frame (default: 0.05 = 50ms) */
  frameDuration?: number
  /** Max frames in sliding buffer (default: 40 = 2s at 50ms frames) */
  maxBufferFrames?: number
}