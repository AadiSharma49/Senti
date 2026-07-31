import { describe, it, expect } from 'vitest'

/**
 * Peak normalisation before transcription.
 *
 * A quiet laptop mic turned "can you hear me" into "My boy can hear me. Bro
 * can hear me." — every word was present in the audio, just too faint for
 * Whisper to resolve. These pin the properties that make boosting safe: the
 * shape of the speech is preserved, silence is left alone, and the gain is
 * capped so a near-silent room doesn't become a wall of hiss.
 *
 * Mirrors the implementation in speechRecognition.ts, which can't be imported
 * here without pulling in the ONNX runtime.
 */
const TARGET_PEAK = 0.85
const MIN_USEFUL_PEAK = 0.005
const MAX_GAIN = 12

function normalize(samples: Float32Array): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i])
    if (v > peak) peak = v
  }
  if (peak < MIN_USEFUL_PEAK || peak >= TARGET_PEAK) return samples

  const gain = Math.min(MAX_GAIN, TARGET_PEAK / peak)
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

const peakOf = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)

describe('audio normalisation', () => {
  it('lifts a quiet clip to full scale', () => {
    // Peak 0.1 needs 8.5x, which is under the cap, so it reaches the target.
    const quiet = new Float32Array([0.04, -0.07, 0.1, -0.06])
    expect(peakOf(normalize(quiet))).toBeCloseTo(TARGET_PEAK, 5)
  })

  it('still helps a very faint clip, even when capped', () => {
    // Below ~0.07 the cap bites and the clip lands short of target — but 12x
    // is the difference between Whisper resolving words and inventing them,
    // so short of target still beats leaving it alone.
    const faint = new Float32Array([0.02, -0.03, 0.05])
    const out = peakOf(normalize(faint))
    expect(out).toBeGreaterThan(0.5)
    expect(out).toBeLessThan(TARGET_PEAK)
  })

  it('leaves an already-loud clip untouched', () => {
    const loud = new Float32Array([0.9, -0.95, 0.88])
    expect(normalize(loud)).toBe(loud)
  })

  it('never pushes past full scale, so nothing clips', () => {
    for (const peak of [0.006, 0.05, 0.3, 0.8]) {
      const out = normalize(new Float32Array([peak, -peak]))
      expect(peakOf(out)).toBeLessThanOrEqual(1)
    }
  })

  it('leaves silence alone rather than amplifying hiss', () => {
    const silence = new Float32Array([0.0001, -0.0002, 0])
    expect(normalize(silence)).toBe(silence)
  })

  it('caps the gain on a very faint clip', () => {
    // 0.006 would otherwise be multiplied by ~140x, turning room noise into
    // something Whisper would try to transcribe as speech.
    const faint = new Float32Array([0.006, -0.006])
    expect(peakOf(normalize(faint))).toBeCloseTo(0.006 * MAX_GAIN, 5)
  })

  it('preserves the shape of the waveform', () => {
    // Every sample scaled by the same number — this is normalisation, not
    // compression. Ratios between samples must survive exactly.
    const src = new Float32Array([0.01, 0.02, 0.04, -0.02])
    const out = normalize(src)
    expect(out[1] / out[0]).toBeCloseTo(2, 6)
    expect(out[2] / out[0]).toBeCloseTo(4, 6)
    expect(out[3] / out[1]).toBeCloseTo(-1, 6)
  })
})
