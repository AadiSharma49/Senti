import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  speedX: number
  speedY: number
}

/**
 * Renders a field of slowly drifting particles for an immersive ambient effect.
 * Particles are created once and animated via CSS transitions (or Framer Motion).
 */
import { useLockStore } from '../../state/lockStore'

export default function ParticleField() {
  const [particles, setParticles] = useState<Particle[]>([])
  const { state, isSpeaking } = useLockStore()
  const active = isSpeaking || state === 'unlocking'

  useEffect(() => {
    const count = 60
    const w = window.innerWidth
    const h = window.innerHeight
    const items: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * w,
      y: Math.random() * h,
      size: 1.5 + Math.random() * 3,
      opacity: 0.15 + Math.random() * 0.35,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
    }))
    setParticles(items)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-accent"
          style={{
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            x: [p.x, p.x + p.speedX * 100, p.x],
            y: [p.y, p.y + p.speedY * 100, p.y],
          }}
          transition={{
            duration: (active ? 8 : 15) + Math.random() * (active ? 10 : 20),
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}