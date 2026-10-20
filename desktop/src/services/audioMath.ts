/** Linear-interpolation resampler; adequate for speech features */
export function resampleTo(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples
  const ratio = fromRate / toRate
  const outLength = Math.floor(samples.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const right = Math.min(left + 1, samples.length - 1)
    const frac = pos - left
    out[i] = samples[left] * (1 - frac) + samples[right] * frac
  }
  return out
}
