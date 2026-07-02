import React from 'react'
import { motion } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'

/**
 * Premium AI visualizer - concentric rings around a glowing central orb
 * that pulse, rotate, and breathe to create a futuristic "AI core" feel.
 */
export default function Visualizer() {
  const { state } = useLockStore()
  const isVerifying = state === 'verifying'
  const isFailed = state === 'failed'
  const isLockout = state === 'lockout'

  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
      {/* Outermost orbit ring */}
      <motion.div
        className={`absolute w-full h-full rounded-full border ${isLockout ? 'border-red-400/60' : 'border-accent-muted'}`}
        animate={{ rotate: 360 }}
        transition={{ duration: isLockout ? 40 : 30, repeat: Infinity, ease: 'linear' }}
      />

      {/* Middle orbit ring (counter-rotating) */}
      <motion.div
        className={`absolute w-3/4 h-3/4 rounded-full border opacity-60 ${isLockout ? 'border-red-500/40' : 'border-accent-muted'}`}
        animate={{ rotate: -360 }}
        transition={{ duration: isLockout ? 30 : 22, repeat: Infinity, ease: 'linear' }}
      />

      {/* Inner pulsing ring */}
      <motion.div
        className={`absolute w-1/2 h-1/2 rounded-full border opacity-40 glow-ring ${isLockout ? 'border-red-400 bg-red-500/10' : 'border-accent'}`}
        animate={{
          scale: isLockout ? [1, 1.05, 1] : isVerifying ? [1, 1.2, 1] : [1, 1.12, 1],
          opacity: isLockout ? [0.45, 0.82, 0.45] : isVerifying ? [0.5, 0.95, 0.5] : [0.4, 0.7, 0.4],
        }}
        transition={{ duration: isLockout ? 2.8 : isVerifying ? 2 : 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Central glowing orb */}
      <motion.div
        className={`absolute w-20 h-20 rounded-full ${isLockout ? 'bg-red-500/80' : 'bg-accent-glow'} glow-ring-strong`}
        animate={{
          scale: isLockout ? [1, 1.18, 1] : isVerifying ? [1, 1.15, 1] : [1, 1.08, 1],
          boxShadow: isFailed
            ? [
                '0 0 30px rgba(255,96,96,0.35), 0 0 60px rgba(255,96,96,0.25)',
                '0 0 50px rgba(255,96,96,0.6), 0 0 100px rgba(255,96,96,0.35)',
                '0 0 30px rgba(255,96,96,0.35), 0 0 60px rgba(255,96,96,0.25)',
              ]
            : isLockout
            ? [
                '0 0 40px rgba(255,80,80,0.45), 0 0 90px rgba(255,50,50,0.3)',
                '0 0 70px rgba(255,90,90,0.75), 0 0 140px rgba(255,60,60,0.45)',
                '0 0 40px rgba(255,80,80,0.45), 0 0 90px rgba(255,50,50,0.3)',
              ]
            : isVerifying
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
        transition={{ duration: isLockout ? 1.6 : isVerifying ? 1.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
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
          }}
        transition={{
          duration: 12 + i * 3,
          repeat: Infinity,
          ease: 'linear',
          delay: i * 1.2,
        }}
        />
      ))}
    </div>
  )
}