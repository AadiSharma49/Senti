import { useEffect } from 'react'
import { useMotionValue, type MotionValue } from 'framer-motion'
import { audioCapture } from '../services/audioCapture'

/**
 * useAudioLevel - exposes the live microphone loudness as a smoothed
 * framer-motion value (0..1). Subscribes to the shared AudioCapture, so
 * whenever a voice session or enrollment is running the value tracks the
 * user's voice; otherwise it rests at 0.
 *
 * Returns a MotionValue (not React state) so consumers animate at 60fps
 * without re-rendering.
 */
export function useAudioLevel(): MotionValue<number> {
  const level = useMotionValue(0)

  useEffect(() => {
    let raf = 0
    let current = 0
    let target = 0

    const unsub = audioCapture.subscribe((_frame, lvl) => {
      // Normalize: ~0.12 RMS is a strong speaking level -> ~1.0
      target = Math.min(1, lvl.rms / 0.12)
    })

    const tick = () => {
      // Asymmetric smoothing: rise fast (feels responsive), fall slow (graceful)
      const k = target > current ? 0.35 : 0.08
      current += (target - current) * k
      level.set(current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [level])

  return level
}
