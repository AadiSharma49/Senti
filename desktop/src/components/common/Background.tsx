import React from 'react'
import { motion } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'

/**
 * Ambient background with multiple visual layers:
 * - Deep gradient base
 * - Slow-moving animated gradient overlay
 * - Subtle scanline layer
 * - Noise grain overlay
 */
export default function Background() {
  const { isSpeaking } = useLockStore()

  return (
    <>
      {/* Base deep gradient or user wallpaper */}
      <div
        className="absolute inset-0 bg-deep-gradient"
        style={{
          backgroundImage: 'var(--wallpaper)',
        }}
      />

      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(0,212,255,0.04) 0%, transparent 50%)',
        }}
        animate={{
          scale: isSpeaking ? [1, 1.04, 1] : [1, 1.05, 1],
          rotate: [0, 2, 0],
          opacity: isSpeaking ? 0.42 : 0.30,
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Subtle grid lines (horizontal & vertical stripes) */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(0deg, transparent 23px, rgba(0,212,255,0.15) 24px, transparent 25px), linear-gradient(90deg, transparent 23px, rgba(0,212,255,0.15) 24px, transparent 25px)',
          backgroundSize: '25px 25px',
        }}
      />

      {/* Scanline overlay */}
      <div className="absolute inset-0 scanlines" />

      {/* Noise texture */}
      <div className="absolute inset-0 bg-noise" />
    </>
  )
}
