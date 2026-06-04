export interface VoiceComparisonResult {
  match: boolean
  confidence: number
  normalizedDetected: string
  normalizedStored: string
  distance: number
  similarity: number
  reason: string
}

const normalizePhrase = (phrase: string) =>
  phrase
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')

const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = []
  const lenA = a.length
  const lenB = b.length

  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[lenA][lenB]
}

const wordMatchScore = (detected: string, stored: string) => {
  const detectedWords = detected.split(' ').filter(Boolean)
  const storedWords = stored.split(' ').filter(Boolean)
  if (!storedWords.length) return 0

  const matched = detectedWords.filter((word) => storedWords.includes(word)).length
  return matched / storedWords.length
}

export interface VoiceValidationOptions {
  threshold?: number // percentage 0-100
}

export const compareVoicePhrase = (
  detectedPhrase: string,
  storedPhrase: string,
  options: VoiceValidationOptions = {}
): VoiceComparisonResult => {
  const threshold = options.threshold ?? 90

  const normalizedDetected = normalizePhrase(detectedPhrase)
  const normalizedStored = normalizePhrase(storedPhrase)
  const distance = levenshteinDistance(normalizedDetected, normalizedStored)

  const maxLength = Math.max(normalizedDetected.length, normalizedStored.length, 1)
  const similarity = Math.max(0, 1 - distance / maxLength)
  const wordScore = wordMatchScore(normalizedDetected, normalizedStored)

  // Weighted scoring: favor character-level similarity but include word overlap
  const score = Math.round((similarity * 0.7 + wordScore * 0.3) * 100)
  const match = score >= threshold

  let reason = 'Phrase similarity is below threshold.'
  if (normalizedDetected === normalizedStored) {
    reason = 'Exact phrase match.'
  } else if (match) {
    reason = 'Near match detected.'
  }

  return {
    match,
    confidence: score,
    normalizedDetected,
    normalizedStored,
    distance,
    similarity,
    reason,
  }
}
