import { ClapPattern } from '../types/unlockProfiles'
import { validateClapPattern, ClapPatternValidationResult } from './clapPatternValidator'

export type UnlockMethod = 'clap' | 'voice' | 'pin'

export interface UnlockValidationResult {
  method: UnlockMethod
  validated: boolean
  confidence: number
  reason: string
  details?: any
}

export interface UnlockValidationOptions {
  threshold?: number
}

export async function validateUnlock(
  method: UnlockMethod,
  payload: unknown,
  options: UnlockValidationOptions = {}
): Promise<UnlockValidationResult> {
  if (method === 'clap') {
    const { storedPattern, currentPattern } = payload as {
      storedPattern: ClapPattern
      currentPattern: ClapPattern | null
    }

    const validation = validateClapPattern(storedPattern, currentPattern, {
      threshold: options.threshold,
    })

    return {
      method: 'clap',
      validated: validation.matched,
      confidence: validation.confidence,
      reason: validation.reason,
      details: validation.details,
    }
  }

  return {
    method,
    validated: false,
    confidence: 0,
    reason: `${method} validation not implemented yet`,
    details: null,
  }
}
