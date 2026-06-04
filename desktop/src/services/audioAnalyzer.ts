/**
 * Audio Analyzer
 *
 * Web Audio API wrapper for real-time audio analysis.
 * Provides FFT analysis, frequency domain processing, and transient detection.
 */

export interface AudioPeak {
  timestamp: number // milliseconds from recording start
  volume: number // 0-1 normalized
  frequency?: number // estimated frequency in Hz
}

export interface AudioAnalysisFrame {
  timestamp: number
  frequencyData: Uint8Array
  waveformData: Uint8Array
  peakAmplitude: number
  maxAmplitude: number
  rmsAmplitude: number
  loudnessDelta: number // change from previous frame
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null
  private analyserNode: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private frequencyData: Uint8Array<ArrayBuffer> | null = null
  private waveformData: Uint8Array<ArrayBuffer> | null = null
  private previousAmplitude = 0
  private isInitialized = false

  // Clap detection tuning
  readonly FFT_SIZE = 2048
  readonly CLAP_THRESHOLD = 0.22 // Normalized amplitude threshold tuned for headset microphones
  readonly MIN_CLAP_INTERVAL = 140 // Minimum ms between distinct claps
  readonly FREQUENCY_RANGE = { min: 1000, max: 7000 } // Hz, relaxed clap spectrum for common headset mics

  async initialize(stream: MediaStream): Promise<boolean> {
    try {
      // Create audio context
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.audioContext = audioCtx

      // Create analyser
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = this.FFT_SIZE
      this.analyserNode = analyser

      // Connect microphone
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      this.microphone = source

      // Initialize buffers
      this.frequencyData = new Uint8Array(analyser.frequencyBinCount)
      this.waveformData = new Uint8Array(analyser.frequencyBinCount)

      console.log('[AudioAnalyzer] Initialized:', {
        fftSize: this.FFT_SIZE,
        frequencyBinCount: analyser.frequencyBinCount,
        sampleRate: audioCtx.sampleRate,
      })

      this.isInitialized = true
      return true
    } catch (error) {
      console.error('[AudioAnalyzer] Initialization failed:', error)
      return false
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.analyserNode !== null
  }

  /**
   * Get current audio analysis frame
   */
  getAnalysisFrame(): AudioAnalysisFrame | null {
    if (!this.analyserNode || !this.frequencyData || !this.waveformData) {
      return null
    }

    // Get frequency and waveform data
    this.analyserNode.getByteFrequencyData(this.frequencyData)
    this.analyserNode.getByteTimeDomainData(this.waveformData)

    let sum = 0
    let maxAmp = 0
    let squaredSum = 0
    for (let i = 0; i < this.waveformData.length; i++) {
      const normalized = (this.waveformData[i] - 128) / 128
      const absValue = Math.abs(normalized)
      sum += absValue
      maxAmp = Math.max(maxAmp, absValue)
      squaredSum += normalized * normalized
    }

    const rmsAmplitude = Math.sqrt(squaredSum / this.waveformData.length)
    const peakAmplitude = Math.min(maxAmp, 1)

    // Calculate loudness delta using RMS for steadier response
    const loudnessDelta = rmsAmplitude - this.previousAmplitude
    this.previousAmplitude = rmsAmplitude

    return {
      timestamp: Date.now(),
      frequencyData: new Uint8Array(this.frequencyData),
      waveformData: new Uint8Array(this.waveformData),
      peakAmplitude,
      maxAmplitude: maxAmp,
      rmsAmplitude,
      loudnessDelta,
    }
  }

  /**
   * Detect transient peaks (claps are transients with fast attack)
   */
  detectPeaks(
    frames: AudioAnalysisFrame[],
    sensitivity = 0.5, // 0-1, higher = more peaks detected
    thresholdOverride?: number
  ): AudioPeak[] {
    const peaks: AudioPeak[] = []
    const threshold = thresholdOverride ?? Math.max(0.08, this.CLAP_THRESHOLD * (1 - sensitivity * 0.45))

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      const isLoudEnough = frame.peakAmplitude > threshold
      const isTransient = frame.loudnessDelta > 0.04
      const clapEnergy = this.getClapFrequencyEnergy(frame.frequencyData)
      const hasClapSpectrum = clapEnergy > 0.10

      if (isLoudEnough && isTransient && hasClapSpectrum) {
        const lastPeak = peaks[peaks.length - 1]
        if (!lastPeak || frame.timestamp - lastPeak.timestamp > this.MIN_CLAP_INTERVAL) {
          peaks.push({
            timestamp: frame.timestamp,
            volume: frame.peakAmplitude,
            frequency: this.estimatePeakFrequency(frame.frequencyData),
          })
        }
      }
    }

    return peaks
  }

  getClapCandidateReason(frame: AudioAnalysisFrame, threshold = 0.12): string | null {
    const clapEnergy = this.getClapFrequencyEnergy(frame.frequencyData)
    const isLoudEnough = frame.peakAmplitude > threshold
    const isTransient = frame.loudnessDelta > 0.04
    const hasClapSpectrum = clapEnergy > 0.10
    const isPotentialCandidate = frame.peakAmplitude > Math.max(0.08, threshold * 0.75) || frame.loudnessDelta > 0.03 || clapEnergy > 0.08

    if (!isPotentialCandidate) {
      return null
    }

    if (!isLoudEnough) {
      return `Amplitude too low (${frame.peakAmplitude.toFixed(3)} < ${threshold.toFixed(3)})`
    }
    if (!isTransient) {
      return `Not transient enough (Δ ${frame.loudnessDelta.toFixed(3)})`
    }
    if (!hasClapSpectrum) {
      return `Spectrum too weak (${clapEnergy.toFixed(3)} < 0.10)`
    }

    return null
  }

  /**
   * Calculate energy in clap frequency range (3-6kHz)
   */
  private getClapFrequencyEnergy(frequencyData: Uint8Array): number {
    if (!this.audioContext) return 0

    const sampleRate = this.audioContext.sampleRate
    const nyquist = sampleRate / 2
    const binSize = nyquist / frequencyData.length

    const minBin = Math.floor(this.FREQUENCY_RANGE.min / binSize)
    const maxBin = Math.floor(this.FREQUENCY_RANGE.max / binSize)

    let sum = 0
    for (let i = minBin; i < maxBin; i++) {
      sum += frequencyData[i]
    }

    return (sum / (maxBin - minBin)) / 255 // Normalize to 0-1
  }

  /**
   * Estimate dominant frequency in clap range
   */
  private estimatePeakFrequency(frequencyData: Uint8Array): number {
    if (!this.audioContext) return 0

    const sampleRate = this.audioContext.sampleRate
    const nyquist = sampleRate / 2
    const binSize = nyquist / frequencyData.length

    const minBin = Math.floor(this.FREQUENCY_RANGE.min / binSize)
    const maxBin = Math.floor(this.FREQUENCY_RANGE.max / binSize)

    let maxValue = 0
    let peakBin = minBin
    for (let i = minBin; i < maxBin; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i]
        peakBin = i
      }
    }

    return peakBin * binSize
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.microphone) {
      this.microphone.disconnect()
      this.microphone = null
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect()
      this.analyserNode = null
    }
    if (this.audioContext) {
      // Don't close context as it may be used elsewhere
      this.audioContext = null
    }
    this.frequencyData = null
    this.waveformData = null
    this.isInitialized = false
    console.log('[AudioAnalyzer] Disposed')
  }
}

export const audioAnalyzer = new AudioAnalyzer()
