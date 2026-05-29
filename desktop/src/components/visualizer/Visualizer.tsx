import React from 'react'
import { motion } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'

/**
 * Premium AI visualizer – concentric rings around a glowing central orb
 * that pulse, rotate, and breathe to create a futuristic "AI core" feel.
 */
export default function Visualizer() {
  const { isSpeaking, state } = useLockStore()
  const speakingOrUnlocking = isSpeaking || state === 'unlocking'
  const isFailed = state === 'failed_attempt'

  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
      {/* Outermost orbit ring */}
      <motion.div
        className="absolute w-full h-full rounded-full border border-accent-muted"
        animate={{ rotate: 360 }}
        // Slower outer orbit for a more relaxed feel
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />

      {/* Middle orbit ring (counter-rotating) */}
      <motion.div
        className="absolute w-3/4 h-3/4 rounded-full border border-accent-muted opacity-60"
        animate={{ rotate: -360 }}
        // Slightly slower counter‑rotation to avoid visual clash
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
      />

      {/* Inner pulsing ring */}
      <motion.div
        className="absolute w-1/2 h-1/2 rounded-full border border-accent opacity-40 glow-ring"
        animate={{
          scale: speakingOrUnlocking ? [1, 1.2, 1] : [1, 1.12, 1],
          opacity: speakingOrUnlocking ? [0.5, 0.95, 0.5] : [0.4, 0.7, 0.4],
        }}
        transition={{ duration: speakingOrUnlocking ? 2 : 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Central glowing orb */}
      <motion.div
        className="absolute w-20 h-20 rounded-full bg-accent-glow glow-ring-strong"
        animate={{
          scale: speakingOrUnlocking ? [1, 1.15, 1] : [1, 1.08, 1],
          boxShadow: isFailed
            ? [
                '0 0 30px rgba(255,96,96,0.35), 0 0 60px rgba(255,96,96,0.25)',
                '0 0 50px rgba(255,96,96,0.6), 0 0 100px rgba(255,96,96,0.35)',
                '0 0 30px rgba(255,96,96,0.35), 0 0 60px rgba(255,96,96,0.25)',
              ]
            : speakingOrUnlocking
            ? [
                '0 0 40px rgba(0,212,255,0.5), 0 0 80px rgba(0,212,255,0.25)',
                '0 0 70px rgba(0,212,255,0.8), 0 0 140px rgba(0,212,255,0.5)',
                '0 0 40px rgba(0,212,255,0.5), 0 0 80px rgba(0,212,255,0.25)',
              ]
            : [
                '0 0 30px rgba(0,212,255,0.3), 0 0 60px rgba(0,212,255,0.15)',
                '0 0 50px rgba(0,212,255,0.5), 0 0 100px rgba(0,212,255,0.3)',
                '0 0 30px rgba(0,212,255,0.3), 0 0 60px rgba(0,212,255,0.15)',
              ],
        }}
        transition={{ duration: speakingOrUnlocking ? 1.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Inner bright core */}
        <div className="absolute inset-2 rounded-full bg-white opacity-30 blur-sm" />
      </motion.div>

      {/* Orbiting dots */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-accent glow-ring"
          style={{
            width: 6 + i * 2,
            height: 6 + i * 2,
          }}
          animate={{
            rotate: 360,
            // use translateX to create orbit; x/y more reliable than transform-origin
          }}
        transition={{
          // Extend orbit duration for smoother motion and stagger starts
          duration: 12 + i * 3,
          repeat: Infinity,
          ease: 'linear',
          delay: i * 1.2,
        }}
          // Manual orbit via CSS animation applied in style
        />
      ))}
    </div>
  )
}
