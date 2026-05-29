import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Displays the current time and date. Updates every second.
 * Uses the CSS variables defined in `index.css` for colors.
 */
export default function Clock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <motion.div
      className="text-center font-display text-primary"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0, scale: [1, 1.02, 1] }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <div className="text-6xl text-glow-strong">{time}</div>
      <div className="mt-2 text-xl text-secondary text-glow">{date}</div>
    </motion.div>
  )
}

