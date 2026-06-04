import { ClapPattern } from '../types/unlockProfiles'

export interface ClapPatternValidationOptions {
  threshold?: number
}

export interface ClapPatternValidationDetails {
  expectedCount: number
  detectedCount: number
  countMatch: boolean
  expectedIntervals: number[]
  detectedIntervals: number[]
  intervalSimilarity: number // 0-1
  rhythmSimilarity: number // 0-1
  averageTimingErrorMs: number
}

export interface ClapPatternValidationResult {
  matched: boolean
  confidence: number
  reason: string
  details: ClapPatternValidationDetails
}

const DEFAULT_THRESHOLD = 70

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

const normalizeRatios = (intervals: number[]): number[] => {
  const total = intervals.reduce((sum, interval) => sum + interval, 0)
  if (total <= 0) return intervals.map(() => 0)
  return intervals.map((interval) => interval / total)
}

const calcIntervalSimilarity = (expected: number[], detected: number[]): number => {
  if (expected.length === 0 || detected.length === 0) return 0
  const length = Math.min(expected.length, detected.length)
  let score = 0

  for (let i = 0; i < length; i++) {
    const a = expected[i]
    const b = detected[i]
    const maxValue = Math.max(a, b, 1)
    score += 1 - Math.abs(a - b) / maxValue
  }

  score /= length
  const lengthPenalty = Math.max(0, 1 - Math.abs(expected.length - detected.length) * 0.12)
  return clamp(score * lengthPenalty, 0, 1)
}

const calcRhythmSimilarity = (expected: number[], detected: number[]): number => {
  const expectedRatios = normalizeRatios(expected)
  const detectedRatios = normalizeRatios(detected)
  const length = Math.min(expectedRatios.length, detectedRatios.length)
  if (length === 0) return 0

  let score = 0
  for (let i = 0; i < length; i++) {
    score += 1 - Math.abs(expectedRatios[i] - detectedRatios[i])
  }

  score /= length
  const lengthPenalty = Math.max(0, 1 - Math.abs(expected.length - detected.length) * 0.08)
  return clamp(score * lengthPenalty, 0, 1)
}

const calcAverageTimingError = (expected: number[], detected: number[]): number => {
  if (expected.length === 0 || detected.length === 0) return 0
  const length = Math.min(expected.length, detected.length)
  let totalError = 0
  for (let i = 0; i < length; i++) {
    totalError += Math.abs(expected[i] - detected[i])
  }
  return totalError / length
}

export function validateClapPattern(
  stored: ClapPattern,
  current: ClapPattern | null,
  options: ClapPatternValidationOptions = {}
): ClapPatternValidationResult {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const expectedIntervals = stored.timingIntervals
  const detectedIntervals = current?.timingIntervals ?? []
  const countMatch = current?.clapCount === stored.clapCount

  const intervalSimilarity = calcIntervalSimilarity(expectedIntervals, detectedIntervals)
  const rhythmSimilarity = calcRhythmSimilarity(expectedIntervals, detectedIntervals)
  const averageTimingErrorMs = calcAverageTimingError(expectedIntervals, detectedIntervals)

  const countScore = countMatch ? 1 : 0.3
  const rawConfidence = countScore * 0.4 + intervalSimilarity * 0.35 + rhythmSimilarity * 0.25
  const confidence = Math.round(clamp(rawConfidence * 100))

  let reason = 'pattern match'
  if (!current) {
    reason = 'no current pattern detected'
  } else if (!countMatch) {
    reason = `clap count mismatch: expected ${stored.clapCount}, got ${current.clapCount}`
  } else if (confidence < threshold) {
    reason = `confidence ${confidence}% below threshold ${threshold}%`
  }

  return {
    matched: confidence >= threshold,
    confidence,
    reason,
    details: {
      expectedCount: stored.clapCount,
      detectedCount: current?.clapCount ?? 0,
      countMatch,
      expectedIntervals,
      detectedIntervals,
      intervalSimilarity,
      rhythmSimilarity,
      averageTimingErrorMs,
    },
  }
}
