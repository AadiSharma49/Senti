/**
 * Clap Detection Engine
 *
 * Orchestrates clap detection, pattern extraction, and profile comparison.
 * This is MVP - detection only, no unlocking.
 */

import { AudioAnalyzer, AudioPeak, AudioAnalysisFrame } from './audioAnalyzer'
import { ClapPattern } from '../types/unlockProfiles'
import { validateClapPattern } from './clapPatternValidator'

export interface DetectionResult {
  detected: boolean
  clapCount: number
  clapSequence: AudioPeak[]
  detectedPattern: {
    clapCount: number
    timingIntervals: number[]
  } | null
  confidence: number
  threshold: number
  analysisFrameCount: number
  timestamp: number
}

export interface PatternComparisonResult {
  match: boolean
  confidence: number
  clapCountMatch: boolean
  timingVariance: number // percentage, lower is better
  reason: string
  details: {
    expectedCount: number
    detectedCount: number
    expectedIntervals: number[]
    detectedIntervals: number[]
  }
}

export class ClapDetectionEngine {
  private analyzeInterval: NodeJS.Timeout | null = null
  private frames: AudioAnalysisFrame[] = []
  private frameBuffer: AudioAnalysisFrame[] = []
  private maxFrames = 300 // ~3 seconds at 100fps
  private isListening = false
  public detectionThreshold = 0.18
  public detectionSensitivity = 0.75

  constructor(private analyzer: AudioAnalyzer) {}

  /**
   * Start listening for claps
   */
  startListening() {
    if (!this.analyzer.isReady()) {
      console.error('[ClapDetection] Analyzer not ready')
      return
    }

    this.isListening = true
    this.frames = []
    this.frameBuffer = []

    console.log('[ClapDetection] Started listening')

    // Capture frames at ~100fps
    this.analyzeInterval = setInterval(() => {
      if (!this.isListening) return

      const frame = this.analyzer.getAnalysisFrame()
      if (frame) {
        this.frameBuffer.push(frame)
        if (this.frameBuffer.length > this.maxFrames) {
          this.frameBuffer.shift()
        }
      }
    }, 10) // 10ms interval = 100fps
  }

  /**
   * Stop listening and return detected pattern
   */
  stopListening(): DetectionResult {
    if (this.analyzeInterval) {
      clearInterval(this.analyzeInterval)
      this.analyzeInterval = null
    }

    this.isListening = false

    const threshold = this.detectionThreshold
    const peaks = this.analyzer.detectPeaks(this.frameBuffer, this.detectionSensitivity, threshold)
    const detectedPattern = this.extractPatternFromPeaks(peaks)

    const result: DetectionResult = {
      detected: peaks.length >= 2,
      clapCount: peaks.length,
      clapSequence: peaks,
      detectedPattern,
      confidence: this.calculateConfidence(peaks),
      threshold,
      analysisFrameCount: this.frameBuffer.length,
      timestamp: Date.now(),
    }

    console.log('[ClapDetection] Stopped listening:', result)
    return result
  }

  /**
   * Extract timing pattern from detected peaks
   */
  private extractPatternFromPeaks(peaks: AudioPeak[]): {
    clapCount: number
    timingIntervals: number[]
  } | null {
    if (peaks.length < 2) return null

    const timingIntervals: number[] = []
    for (let i = 1; i < peaks.length; i++) {
      timingIntervals.push(peaks[i].timestamp - peaks[i - 1].timestamp)
    }

    return {
      clapCount: peaks.length,
      timingIntervals,
    }
  }

  /**
   * Calculate confidence score based on peak characteristics
   */
  private calculateConfidence(peaks: AudioPeak[]): number {
    if (peaks.length === 0) return 0

    // Factors:
    // 1. Peak volume consistency (claps should have similar volume)
    // 2. Peak count (more peaks = more confidence)
    // 3. Timing regularity (consistent intervals = higher confidence)

    const avgVolume = peaks.reduce((sum, p) => sum + p.volume, 0) / peaks.length
    const volumeVariance = peaks.reduce((sum, p) => sum + Math.abs(p.volume - avgVolume), 0) / peaks.length

    // Penalty for high variance
    const volumeConsistency = Math.max(0, 1 - volumeVariance * 2)

    // Bonus for 3-5 claps (typical range)
    const clapCountScore = peaks.length >= 3 && peaks.length <= 5 ? 1.0 : Math.max(0, 1 - Math.abs(peaks.length - 4) * 0.2)

    // Calculate timing regularity
    let timingScore = 1.0
    if (peaks.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i].timestamp - peaks[i - 1].timestamp)
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const intervalVariance = intervals.reduce((sum, interval) => sum + Math.abs(interval - avgInterval), 0) / intervals.length
      timingScore = Math.max(0, 1 - intervalVariance / avgInterval * 0.5) // Normalized variance
    }

    // Combine factors
    const confidence = (volumeConsistency * 0.3 + clapCountScore * 0.3 + timingScore * 0.4) * 100

    return Math.round(confidence)
  }

  /**
   * Compare detected pattern against trained profile
   */
  compareWithProfile(detected: DetectionResult, trained: ClapPattern): PatternComparisonResult {
    const currentPattern = detected.detectedPattern
      ? {
          ...detected.detectedPattern,
          capturedAt: detected.timestamp,
        }
      : null
    const validation = validateClapPattern(trained, currentPattern)

    return {
      match: validation.matched,
      confidence: validation.confidence,
      clapCountMatch: validation.details.countMatch,
      timingVariance: Math.round((1 - validation.details.intervalSimilarity) * 100),
      reason: validation.reason,
      details: {
        expectedCount: validation.details.expectedCount,
        detectedCount: validation.details.detectedCount,
        expectedIntervals: validation.details.expectedIntervals,
        detectedIntervals: validation.details.detectedIntervals,
      },
    }
  }

  isListening_(): boolean {
    return this.isListening
  }

  dispose() {
    if (this.analyzeInterval) {
      clearInterval(this.analyzeInterval)
      this.analyzeInterval = null
    }
    this.isListening = false
    this.frames = []
    this.frameBuffer = []
  }
}
