import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWakeStore } from '../../state/wakeStore'

/**
 * The orb.
 *
 * Say "Senti" anywhere and this floats up in the middle of the screen —
 * concentric rings turning against each other, a core that breathes. It exists
 * so hands-free never feels like guesswork: the moment it appears, you KNOW it
 * heard you, and you can watch it think, act, and answer.
 *
 * The window behind it is transparent, so only the orb is drawn over whatever
 * you're actually working in.
 */

const STATUS: Record<string, string> = {
  heard: 'Listening',
  working: 'Working',
  speaking: 'Senti',
}

/** Evenly spaced ticks around a ring — the "instrument" look. */
function Ticks({ r, count, len, width, opacity }: { r: number; count: number; len: number; width: number; opacity: number }) {
  return (
    <g opacity={opacity}>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        return (
          <line
            key={i}
            x1={150 + cos * r}
            y1={150 + sin * r}
            x2={150 + cos * (r + len)}
            y2={150 + sin * (r + len)}
            stroke="currentColor"
            strokeWidth={width}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

export default function WakeHud() {
  const state = useWakeStore((s) => s.state)
  const detail = useWakeStore((s) => s.detail)
  const visible = state === 'heard' || state === 'working' || state === 'speaking'

  // Everything speeds up while it's thinking, settles while it speaks.
  const busy = state === 'working'
  const spin = busy ? 6 : 22
  const spinBack = busy ? 9 : 30

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Gentle float, so it feels alive rather than pasted on */}
          <motion.div
            className="relative"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Ambient glow */}
            <div
              className="absolute inset-0 rounded-full blur-2xl"
              style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.28), transparent 65%)' }}
            />

            <svg width="300" height="300" viewBox="0 0 300 300" className="relative text-accent">
              {/* Outer ring, turning slowly */}
              <motion.g
                style={{ originX: '150px', originY: '150px' }}
                animate={{ rotate: 360 }}
                transition={{ duration: spin, repeat: Infinity, ease: 'linear' }}
              >
                <circle cx="150" cy="150" r="128" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                <circle
                  cx="150"
                  cy="150"
                  r="128"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="120 680"
                  opacity="0.9"
                />
                <Ticks r={112} count={48} len={7} width={1.2} opacity={0.35} />
              </motion.g>

              {/* Middle ring, counter-rotating */}
              <motion.g
                style={{ originX: '150px', originY: '150px' }}
                animate={{ rotate: -360 }}
                transition={{ duration: spinBack, repeat: Infinity, ease: 'linear' }}
              >
                <circle cx="150" cy="150" r="92" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                <circle
                  cx="150"
                  cy="150"
                  r="92"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="60 220 140 160"
                  opacity="0.75"
                />
                <Ticks r={78} count={24} len={5} width={1} opacity={0.4} />
              </motion.g>

              {/* Inner ring — pulses with the breath of the core */}
              <motion.circle
                cx="150"
                cy="150"
                r="58"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                animate={{ opacity: [0.35, 0.8, 0.35], r: [58, 62, 58] }}
                transition={{ duration: busy ? 1.1 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Core */}
              <motion.circle
                cx="150"
                cy="150"
                r="26"
                fill="currentColor"
                animate={{ opacity: [0.55, 1, 0.55], r: [24, 29, 24] }}
                transition={{ duration: busy ? 0.9 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ filter: 'drop-shadow(0 0 18px rgba(0,212,255,0.95))' }}
              />
            </svg>
          </motion.div>

          {/* What it's doing / what it heard */}
          <div className="-mt-2 flex max-w-[340px] flex-col items-center gap-1.5 text-center">
            <div className="text-[0.65rem] uppercase tracking-[0.4em] text-accent">
              {STATUS[state] ?? 'Senti'}
            </div>
            {detail && (
              <motion.div
                key={detail}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="line-clamp-2 text-sm text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]"
              >
                {detail}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
