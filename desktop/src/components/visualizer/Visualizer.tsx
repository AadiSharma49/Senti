import { motion, useTransform } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'
import { useAudioLevel } from '../../hooks/useAudioLevel'

/**
 * Senti orb — a clean, minimal system of segmented (gapped) rings on a
 * dark field. The rings rotate continuously and the whole mark, plus a
 * small open core, react to the live microphone level. Monochrome/gray
 * by design; only shifts to red on a failed / lockout state.
 */
export default function Visualizer() {
  const { state } = useLockStore()
  const level = useAudioLevel()

  const isVerifying = state === 'verifying'
  const alarm = state === 'failed' || state === 'lockout'

  // Voice-reactive (driven by mic level, no re-render)
  const scale = useTransform(level, [0, 1], [1, 1.07])
  const coreScale = useTransform(level, [0, 1], [1, 1.9])
  const coreOpacity = useTransform(level, [0, 1], [0.35, 0.95])
  const glowOpacity = useTransform(level, [0, 1], [0.12, 0.42])

  const bright = alarm ? 'rgba(255,120,120,0.75)' : 'rgba(226,232,240,0.6)'
  const dim = alarm ? 'rgba(255,120,120,0.35)' : 'rgba(160,172,190,0.28)'
  const faint = alarm ? 'rgba(255,120,120,0.2)' : 'rgba(140,152,170,0.18)'

  const spin = (r: number) => ({
    transformBox: 'fill-box' as const,
    transformOrigin: 'center' as const,
    r,
  })

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
            : 'radial-gradient(circle, rgba(210,220,235,0.5), transparent 70%)',
          filter: 'blur(14px)',
        }}
      />

      <svg viewBox="0 0 200 200" className="absolute h-full w-full" fill="none">
        {/* Outer sparse ring */}
        <motion.circle
          cx={100}
          cy={100}
          stroke={faint}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeDasharray="70 46"
          style={spin(94)}
          animate={{ rotate: 360 }}
          transition={{ duration: alarm ? 30 : 26, repeat: Infinity, ease: 'linear' }}
        />
        {/* Main gapped ring (counter-rotating) */}
        <motion.circle
          cx={100}
          cy={100}
          stroke={bright}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="104 70 38 70"
          style={spin(74)}
          animate={{ rotate: -360 }}
          transition={{ duration: isVerifying ? 7 : 19, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner thin ring */}
        <motion.circle
          cx={100}
          cy={100}
          stroke={dim}
          strokeWidth={1}
          strokeLinecap="round"
          strokeDasharray="34 24"
          style={spin(54)}
          animate={{ rotate: 360 }}
          transition={{ duration: isVerifying ? 10 : 32, repeat: Infinity, ease: 'linear' }}
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
          background: alarm ? '#ff8a8a' : '#e6ebf2',
          boxShadow: alarm ? '0 0 16px rgba(255,120,120,0.7)' : '0 0 16px rgba(220,228,240,0.6)',
        }}
      />
    </motion.div>
  )
}
