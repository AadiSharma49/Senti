/**
 * AudioCapture — Reusable microphone capture service.
 *
 * Provides raw PCM audio frames and RMS levels for downstream
 * authentication engines (Voice, Clap, Wake Word).
 *
 * Uses only Web Audio API:
 *   MediaDevices.getUserMedia → AudioContext → AnalyserNode
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
  fftSize: 2048,
  frameDuration: 0.05, // 50 ms per frame
  maxBufferFrames: 40,  // 2 seconds at 50ms
}

export class AudioCapture {
  private config: Required<AudioCaptureConfig>
  private state: AudioCaptureState = 'idle'
  private error: string | null = null
  private deviceLabel: string | null = null

  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private animationFrameId: number | null = null

  private frameCallbacks: Set<AudioFrameCallback> = new Set()
  private statusCallbacks: Set<AudioStatusCallback> = new Set()

  private dataArray: Float32Array | null = null
  private fftSize: number = DEFAULT_CONFIG.fftSize

  constructor(config?: AudioCaptureConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.fftSize = this.config.fftSize
  }

  // ─── Public API ───────────────────────────────────────────────

  /** Request microphone permission without starting capture */
  async requestPermission(): Promise<boolean> {
    try {
      this.setState('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the test stream immediately — we only needed permission
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

      // Create analyser for level detection + raw data
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = this.fftSize
      this.source.connect(this.analyser)

      // Pre-allocate data array
      this.dataArray = new Float32Array(this.analyser.frequencyBinCount)

      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.setState('active')

      // Start the capture loop
      this.captureLoop()
    } catch (err) {
      this.handleError(err)
      throw err
    }
  }

  /** Stop capturing audio and release resources */
  stop(): void {
    // Stop the animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
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
    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    this.dataArray = null
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

  /** Subscribe to raw audio frames (called ~20 times/sec) */
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

  // ─── Private ──────────────────────────────────────────────────

  private lastLevel: AudioLevel = { rms: 0, peak: 0, clipped: false }
  private lastTimestamp: number = 0

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

  private buildFrame(): AudioFrame {
    const now = performance.now()
    const duration = (now - this.lastTimestamp) / 1000
    this.lastTimestamp = now

    const samples = new Float32Array(this.dataArray!.length)
    this.analyser!.getFloatTimeDomainData(samples)

    return {
      samples,
      sampleRate: this.audioContext!.sampleRate,
      channels: 1,
      timestamp: now,
      duration,
    }
  }

  private captureLoop(): void {
    if (this.state !== 'active') return

    const frame = this.buildFrame()
    this.lastLevel = this.computeLevel(frame.samples)

    this.frameCallbacks.forEach((cb) => {
      try {
        cb(frame, this.lastLevel)
      } catch {
        // Silently ignore subscriber errors
      }
    })

    this.animationFrameId = requestAnimationFrame(() => this.captureLoop())
  }
}
