import { motion, useTransform } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'
import { useAudioLevel } from '../../hooks/useAudioLevel'

/**
 * Senti living orb — an iridescent holographic ring that breathes on its
 * own and reacts to the user's voice in real time. Colour shifts with the
 * auth state (listening / verifying / failed / lockout).
 */
export default function Visualizer() {
  const { state } = useLockStore()
  const level = useAudioLevel()

  const isVerifying = state === 'verifying'
  const isListening = state === 'listening_voice'
  const isFailed = state === 'failed'
  const isLockout = state === 'lockout'
  const alarm = isFailed || isLockout

  // Voice-reactive transforms (driven by live mic level, no re-render)
  const ringScale = useTransform(level, [0, 1], [1, 1.14])
  const coreScale = useTransform(level, [0, 1], [1, 1.55])
  const coreOpacity = useTransform(level, [0, 1], [0.55, 1])
  const glowBlur = useTransform(level, [0, 1], [18, 42])
  const haloOpacity = useTransform(level, [0, 1], [0.25, 0.7])

  // Iridescent conic gradient for the ring band (holographic look)
  const iridescent =
    'conic-gradient(from 0deg,#00d4ff,#4d9bff,#b14dff,#00e5a0,#7c4dff,#00d4ff)'
  const alarmGradient =
    'conic-gradient(from 0deg,#ff5a5a,#ff2d55,#ff8a3d,#ff2d55,#ff5a5a)'

  const ringMask =
    'radial-gradient(closest-side, transparent 60%, #000 63%, #000 80%, transparent 84%)'

  return (
    <div className="relative flex h-72 w-72 items-center justify-center">
      {/* Soft outer halo that pulses with the voice */}
      <motion.div
        className="absolute h-full w-full rounded-full"
        style={{
          opacity: haloOpacity,
          background: alarm
            ? 'radial-gradient(circle, rgba(255,60,60,0.35) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(0,212,255,0.28) 0%, transparent 65%)',
        }}
      />

      {/* Outer iridescent ring (slow spin) */}
      <motion.div
        className="absolute h-full w-full rounded-full"
        style={{ scale: ringScale }}
      >
        <motion.div
          className="h-full w-full rounded-full"
          style={{
            background: alarm ? alarmGradient : iridescent,
            WebkitMaskImage: ringMask,
            maskImage: ringMask,
            filter: `blur(1px) saturate(1.3)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: isLockout ? 26 : isVerifying ? 8 : 20, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>

      {/* Inner counter-rotating ring for the twisted, layered depth */}
      <motion.div
        className="absolute rounded-full"
        style={{ height: '74%', width: '74%', scale: ringScale }}
      >
        <motion.div
          className="h-full w-full rounded-full opacity-80"
          style={{
            background: alarm ? alarmGradient : iridescent,
            WebkitMaskImage: ringMask,
            maskImage: ringMask,
            filter: 'blur(2px) saturate(1.4) hue-rotate(40deg)',
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: isLockout ? 20 : isVerifying ? 6 : 15, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>

      {/* Breathing thin accent ring */}
      <motion.div
        className="absolute rounded-full border"
        style={{
          height: '52%',
          width: '52%',
          borderColor: alarm ? 'rgba(255,90,90,0.6)' : 'rgba(0,212,255,0.5)',
        }}
        animate={{
          scale: isVerifying ? [1, 1.12, 1] : [1, 1.06, 1],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{ duration: isVerifying ? 1.8 : isListening ? 2.6 : 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Central glowing core — scales with the voice */}
      <motion.div
        className="absolute rounded-full"
        style={{
          height: '26%',
          width: '26%',
          scale: coreScale,
          opacity: coreOpacity,
          background: alarm
            ? 'radial-gradient(circle at 40% 35%, #fff, #ff6b6b 45%, #ff2d55 100%)'
            : 'radial-gradient(circle at 40% 35%, #ffffff, #67e8ff 40%, #00d4ff 100%)',
          boxShadow: alarm
            ? '0 0 40px rgba(255,60,60,0.7)'
            : '0 0 40px rgba(0,212,255,0.7)',
          filter: 'blur(0.3px)',
        }}
      />
      {/* Reactive glow layer behind the core */}
      <motion.div
        className="absolute rounded-full"
        style={{
          height: '26%',
          width: '26%',
          scale: coreScale,
          background: alarm ? 'rgba(255,60,60,0.6)' : 'rgba(0,212,255,0.6)',
          filter: useTransform(glowBlur, (b) => `blur(${b}px)`),
        }}
      />
    </div>
  )
}
