import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'

/**
 * Custom Senti cursor — a precise accent dot with a soft trailing ring
 * that springs after it. Replaces the native cursor for a cohesive,
 * futuristic feel. Turns red while in a failed/lockout state.
 */
export default function CustomCursor() {
  const { state } = useLockStore()
  const alarm = state === 'failed' || state === 'lockout'

  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const ringX = useSpring(x, { stiffness: 220, damping: 26, mass: 0.6 })
  const ringY = useSpring(y, { stiffness: 220, damping: 26, mass: 0.6 })
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    const down = () => setPressed(true)
    const up = () => setPressed(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mousedown', down)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mousedown', down)
      window.removeEventListener('mouseup', up)
    }
  }, [x, y])

  const color = alarm ? 'rgba(255,80,80,1)' : 'var(--accent)'
  const ringColor = alarm ? 'rgba(255,80,80,0.6)' : 'rgba(0,212,255,0.55)'

  return (
    <>
      {/* Trailing ring */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{ x: ringX, y: ringY }}
      >
        <motion.div
          style={{
            width: 34,
            height: 34,
            marginLeft: -17,
            marginTop: -17,
            borderRadius: '9999px',
            border: `1px solid ${ringColor}`,
            boxShadow: `0 0 18px ${ringColor}`,
          }}
          animate={{ scale: pressed ? 0.7 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      </motion.div>

      {/* Precise dot */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{ x, y }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            marginLeft: -3,
            marginTop: -3,
            borderRadius: '9999px',
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
      </motion.div>
    </>
  )
}
