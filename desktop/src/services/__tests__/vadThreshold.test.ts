import { describe, it, expect } from 'vitest'
import { VoiceActivityDetector } from '../voiceActivityDetector'

/**
 * The bug these pin down: a FIXED threshold meant a quiet microphone only
 * cleared the bar on its loudest syllable, so a whole sentence arrived as one
 * word. Whisper then transcribed that fragment perfectly, which made it look
 * like a mishearing rather than a recording problem.
 */

/** Drive the detector with levels, since it normally reads from a capture. */
function feed(vad: VoiceActivityDetector, rms: number, frames: number): void {
  const proc = (vad as unknown as { processLevel: (l: { rms: number; peak: number; clipped: boolean }) => void })
    .processLevel.bind(vad)
  for (let i = 0; i < frames; i++) proc({ rms, peak: rms, clipped: false })
}

describe('adaptive VAD threshold', () => {
  it('starts sensitive enough for a quiet microphone', () => {
    const vad = new VoiceActivityDetector()
    // A laptop built-in at conversational volume sits well under the old
    // fixed 0.02 cutoff. It must still register as speech.
    expect(vad.getThreshold()).toBeLessThan(0.02)
  })

  it('detects speech on a quiet mic', () => {
    const vad = new VoiceActivityDetector()
    feed(vad, 0.0005, 40) // near-silent room
    expect(vad.getState()).toBe('silent')
    feed(vad, 0.012, 5) // quiet speech — below the old fixed threshold
    expect(vad.getState()).toBe('speaking')
  })

  it('raises the bar in a noisy room instead of triggering constantly', () => {
    const quiet = new VoiceActivityDetector()
    feed(quiet, 0.0005, 200)
    const noisy = new VoiceActivityDetector()
    feed(noisy, 0.02, 400) // loud, steady background

    expect(noisy.getThreshold()).toBeGreaterThan(quiet.getThreshold())
  })

  it('never drops so low that room hum counts as speech', () => {
    const vad = new VoiceActivityDetector()
    feed(vad, 0, 500) // perfect silence
    expect(vad.getThreshold()).toBeGreaterThanOrEqual(0.004)
  })

  it('never rises so high that speech cannot get through', () => {
    const vad = new VoiceActivityDetector()
    feed(vad, 1, 1000) // absurdly loud, sustained
    expect(vad.getThreshold()).toBeLessThanOrEqual(0.05)
  })

  it('does not let ongoing speech deafen it mid-sentence', () => {
    // The floor only tracks while silent. If speech raised it, a long sentence
    // would walk the threshold up past its own volume and cut itself off.
    const vad = new VoiceActivityDetector()
    feed(vad, 0.0005, 60)
    const before = vad.getThreshold()
    feed(vad, 0.05, 200) // a long, loud utterance
    expect(vad.getState()).toBe('speaking')
    expect(vad.getThreshold()).toBeCloseTo(before, 5)
  })

  it('waits out a pause between words before ending the turn', () => {
    const vad = new VoiceActivityDetector()
    feed(vad, 0.0005, 40)
    feed(vad, 0.05, 5)
    expect(vad.getState()).toBe('speaking')
    // ~250ms gap — an ordinary pause, not the end of a sentence.
    feed(vad, 0.0005, 5)
    expect(vad.getState()).toBe('speaking')
  })
})
