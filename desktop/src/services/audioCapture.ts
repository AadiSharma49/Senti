/**
 * AudioCapture - Reusable microphone capture service.
 *
 * Provides raw PCM audio frames and RMS levels for downstream
 * authentication engines (Voice, Clap, Wake Word).
 *
 * Uses only Web Audio API:
 *   MediaDevices.getUserMedia -> AudioContext -> ScriptProcessorNode
 *
 * Frames are CONTIGUOUS: every microphone sample is delivered exactly
 * once, in order. Subscribers can concatenate frame samples to rebuild
 * a gapless recording (required for voice enrollment/verification).
 *
 * ScriptProcessorNode is deprecated in favor of AudioWorklet, but it is
 * fully supported in Chromium, needs no separate module file, and works
 * under both dev-server and file:// production loads. Migrating to
 * AudioWorklet is a contained future change inside this service only.
 *
 * No authentication logic. No backend. No Electron IPC. No AI.
 */

import type {
  AudioCaptureState,
  AudioLevel,
  AudioFrame,
  AudioCaptureConfig,
  AudioFrameCallback,
  AudioStatusCallback,
  MicrophoneStatus,
} from '../types/audio'

const DEFAULT_CONFIG: Required<AudioCaptureConfig> = {
  sampleRate: 44100,
  fftSize: 2048,        // processor buffer size: 2048 samples ≈ 46ms per frame at 44.1kHz
  frameDuration: 0.05,  // nominal frame duration (informational)
  maxBufferFrames: 40,  // 2 seconds at ~50ms
}

export class AudioCapture {
  private config: Required<AudioCaptureConfig>
  private state: AudioCaptureState = 'idle'
  private error: string | null = null
  private deviceLabel: string | null = null

  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null

  private frameCallbacks: Set<AudioFrameCallback> = new Set()
  private statusCallbacks: Set<AudioStatusCallback> = new Set()

  constructor(config?: AudioCaptureConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // --- Public API ---------------------------------------------------

  /** Request microphone permission without starting capture */
  async requestPermission(): Promise<boolean> {
    try {
      this.setState('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the test stream immediately - we only needed permission
      stream.getTracks().forEach((t) => t.stop())
      this.setState('idle')
      return true
    } catch (err) {
      this.handleError(err)
      return false
    }
  }

  /** Start capturing audio from the microphone */
  async start(): Promise<void> {
    if (this.state === 'active') return

    try {
      this.setState('requesting')

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.deviceLabel = this.stream.getAudioTracks()[0]?.label || null

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })

      // Create source from stream
      this.source = this.audioContext.createMediaStreamSource(this.stream)

      // ScriptProcessorNode delivers contiguous PCM buffers.
      // Buffer size 2048 at 44.1kHz -> one frame every ~46ms.
      this.processor = this.audioContext.createScriptProcessor(this.config.fftSize, 1, 1)
      this.processor.onaudioprocess = (event) => this.handleAudioProcess(event)

      this.source.connect(this.processor)
      // Processor must be connected to destination to run; its output
      // buffer is left as silence so no mic audio reaches the speakers.
      this.processor.connect(this.audioContext.destination)

      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.setState('active')
    } catch (err) {
      this.handleError(err)
      throw err
    }
  }

  /** Stop capturing audio and release resources */
  stop(): void {
    // Stop and release the processor
    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
      this.processor = null
    }

    // Stop and release media stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }

    // Disconnect and close audio context
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    this.deviceLabel = null
    this.error = null
    this.setState('idle')
  }

  /** Check if microphone is currently recording */
  isRecording(): boolean {
    return this.state === 'active'
  }

  /** Get current RMS audio level (cached from last frame) */
  getCurrentLevel(): AudioLevel {
    return this.lastLevel
  }

  /** Get current microphone status */
  getStatus(): MicrophoneStatus {
    return {
      state: this.state,
      error: this.error,
      deviceLabel: this.deviceLabel,
      sampleRate: this.audioContext?.sampleRate ?? null,
    }
  }

  /** Subscribe to contiguous audio frames (one every ~46ms) */
  subscribe(callback: AudioFrameCallback): () => void {
    this.frameCallbacks.add(callback)
    return () => {
      this.frameCallbacks.delete(callback)
    }
  }

  /** Subscribe to status changes */
  onStatusChange(callback: AudioStatusCallback): () => void {
    this.statusCallbacks.add(callback)
    return () => {
      this.statusCallbacks.delete(callback)
    }
  }

  /** Release all resources and clean up */
  dispose(): void {
    this.stop()
    this.frameCallbacks.clear()
    this.statusCallbacks.clear()
  }

  // --- Private ------------------------------------------------------

  private lastLevel: AudioLevel = { rms: 0, peak: 0, clipped: false }

  private setState(newState: AudioCaptureState): void {
    this.state = newState
    this.notifyStatus()
  }

  private handleError(err: unknown): void {
    const message =
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : err instanceof Error
        ? err.message
        : 'Unknown microphone error'
    this.error = message
    this.setState('error')
  }

  private notifyStatus(): void {
    const status = this.getStatus()
    this.statusCallbacks.forEach((cb) => cb(status))
  }

  private computeLevel(data: Float32Array): AudioLevel {
    let sumSquares = 0
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const s = Math.abs(data[i])
      sumSquares += s * s
      if (s > peak) peak = s
    }
    const rms = Math.sqrt(sumSquares / data.length)
    return { rms, peak, clipped: peak >= 1.0 }
  }

  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (this.state !== 'active') return

    const input = event.inputBuffer.getChannelData(0)
    // Copy: the underlying buffer is reused by the audio engine
    const samples = new Float32Array(input)
    const sampleRate = this.audioContext?.sampleRate ?? this.config.sampleRate

    const frame: AudioFrame = {
      samples,
      sampleRate,
      channels: 1,
      timestamp: performance.now(),
      duration: samples.length / sampleRate,
    }

    this.lastLevel = this.computeLevel(samples)

    this.frameCallbacks.forEach((cb) => {
      try {
        cb(frame, this.lastLevel)
      } catch {
        // Silently ignore subscriber errors
      }
    })
  }
}

/**
 * App-wide shared microphone instance. Production code (voice unlock,
 * enrollment, future clap engine) must use this single instance and
 * subscribe to it — never create additional captures. Debug panels may
 * create their own isolated instances.
 */
export const audioCapture = new AudioCapture()
