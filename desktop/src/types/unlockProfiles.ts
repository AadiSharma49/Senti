/**
 * Unlock Profile Types
 *
 * Type definitions for Voice, Clap, and PIN unlock profiles.
 * These structures enable training, storage, and future detection integration.
 */

/**
 * Clap pattern profile — stores clap sequence metadata
 * Captured during training without performing actual detection.
 */
export interface ClapPattern {
  clapCount: number // e.g., 3 or 4 claps
  timingIntervals: number[] // milliseconds between claps
  capturedAt: number // timestamp
}

export interface ClapProfile {
  trained: boolean
  lastTrained: number | null // timestamp
  patterns: ClapPattern[] // multiple training attempts
  primaryPattern: ClapPattern | null // best/confirmed pattern
  version: 1 // for future migrations
}

/**
 * Voice phrase profile — stores voice phrase metadata
 * Captured during training without performing actual recognition.
 */
export interface VoicePhrase {
  phrase: string // e.g., "Senti unlock"
  recordedAt: number // timestamp
  duration?: number // milliseconds of recording
  metadata: {
    confidence?: number
    quality?: 'poor' | 'fair' | 'good' | 'excellent'
  }
}

export interface VoiceProfile {
  trained: boolean
  lastTrained: number | null // timestamp
  phrases: VoicePhrase[] // multiple training attempts/phrases
  primaryPhrase: VoicePhrase | null // selected/confirmed phrase
  version: 1 // for future migrations
}

/**
 * PIN profile — minimal metadata wrapper for PIN unlock
 */
export interface PinProfile {
  trained: true // always true if PIN is set
  lastConfigured: number | null // timestamp
  version: 1
}

/**
 * Unified unlock method configuration
 */
export interface UnlockMethodConfig {
  enabled: boolean
  configured: boolean
  lastTrained?: number | null
  trainingInProgress?: boolean
}

/**
 * Future detection engine interface
 * Prepared for voice/clap detection implementation
 */
export interface DetectionEngine {
  name: string // 'voice' | 'clap' | 'pin'
  detect(input: unknown): Promise<boolean>
  validate(profile: VoiceProfile | ClapProfile | PinProfile): boolean
}

/**
 * Future recognition result from detection engines
 */
export interface RecognitionResult {
  method: 'voice' | 'clap' | 'pin'
  detected: boolean
  confidence?: number
  timestamp: number
}

/**
 * Future unlock validation engine
 * Coordinates detection engines and produces unlock decisions
 */
export interface UnlockValidator {
  validateWithVoice(profile: VoiceProfile): Promise<boolean>
  validateWithClap(profile: ClapProfile): Promise<boolean>
  validateWithPin(pin: string, storedPin: string): boolean
}
