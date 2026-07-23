import { motion, useTransform, useSpring } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'
import { useAudioLevel } from '../../hooks/useAudioLevel'

/**
 * Senti orb — a clean, minimal system of segmented (gapped) rings on a
 * dark field with an open center. Ring rotation runs as GPU-composited
 * CSS animation (perfectly smooth), while the mic level drives a spring
 * that scales/glows the mark. Monochrome; red only on failed / lockout.
 */
export default function Visualizer() {
  const { state } = useLockStore()
  const level = useAudioLevel()
  const alarm = state === 'failed' || state === 'lockout'

  // Spring-smooth the reactive values so voice changes feel fluid.
  const smooth = useSpring(level, { stiffness: 120, damping: 18, mass: 0.5 })
  const scale = useTransform(smooth, [0, 1], [1, 1.07])
  const coreScale = useTransform(smooth, [0, 1], [1, 1.9])
  const coreOpacity = useTransform(smooth, [0, 1], [0.35, 0.95])
  const glowOpacity = useTransform(smooth, [0, 1], [0.12, 0.42])

  // Senti cyan — this is the mark, so it carries the brand, not grey.
  const bright = alarm ? 'rgba(255,120,120,0.8)' : 'rgba(0,212,255,0.85)'
  const dim = alarm ? 'rgba(255,120,120,0.35)' : 'rgba(0,190,235,0.4)'
  const faint = alarm ? 'rgba(255,120,120,0.2)' : 'rgba(90,210,255,0.22)'

  return (
    <motion.div className="relative flex h-72 w-72 items-center justify-center" style={{ scale }}>
      {/* Soft central glow, reacts to voice */}
      <motion.div
        className="absolute rounded-full"
        style={{
          height: '46%',
          width: '46%',
          opacity: glowOpacity,
          background: alarm
            ? 'radial-gradient(circle, rgba(255,90,90,0.6), transparent 70%)'
            : 'radial-gradient(circle, rgba(0,212,255,0.55), transparent 70%)',
          filter: 'blur(16px)',
        }}
      />

      <svg viewBox="0 0 200 200" className="absolute h-full w-full" fill="none">
        {/* Outer sparse ring */}
        <circle
          className="orb-ring"
          cx={100}
          cy={100}
          r={94}
          stroke={faint}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeDasharray="70 46"
          style={{ animation: 'orb-spin 30s linear infinite' }}
        />
        {/* Main gapped ring (counter-rotating) */}
        <circle
          className="orb-ring"
          cx={100}
          cy={100}
          r={74}
          stroke={bright}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="104 70 38 70"
          style={{ animation: 'orb-spin-rev 22s linear infinite' }}
        />
        {/* Inner thin ring */}
        <circle
          className="orb-ring"
          cx={100}
          cy={100}
          r={54}
          stroke={dim}
          strokeWidth={1}
          strokeLinecap="round"
          strokeDasharray="34 24"
          style={{ animation: 'orb-spin 38s linear infinite' }}
        />
      </svg>

      {/* Small open core — kept tiny so the centre reads as open space */}
      <motion.div
        className="absolute rounded-full"
        style={{
          height: '7%',
          width: '7%',
          scale: coreScale,
          opacity: coreOpacity,
          background: alarm ? '#ff8a8a' : '#7fe9ff',
          boxShadow: alarm ? '0 0 16px rgba(255,120,120,0.7)' : '0 0 22px rgba(0,212,255,0.9)',
        }}
      />
    </motion.div>
  )
}
