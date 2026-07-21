import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWakeStore } from '../../state/wakeStore'

/**
 * The little panel that appears in the corner when you say "Senti".
 *
 * It exists so hands-free never feels like nothing happened: you speak, this
 * slides in, you watch it work, it says the result, it goes away.
 */
const LABEL: Record<string, string> = {
  heard: 'Listening',
  working: 'Working on it',
  speaking: 'Senti',
}

export default function WakeHud() {
  const state = useWakeStore((s) => s.state)
  const detail = useWakeStore((s) => s.detail)
  const visible = state === 'heard' || state === 'working' || state === 'speaking'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-black/80 px-5 py-4 glass-strong shadow-2xl shadow-cyan-500/10">
            {/* Pulsing orb — alive while it's thinking, steady while speaking */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-full bg-accent/25"
                animate={
                  state === 'speaking'
                    ? { scale: 1, opacity: 0.5 }
                    : { scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }
                }
                transition={{ duration: 1.5, repeat: state === 'speaking' ? 0 : Infinity, ease: 'easeOut' }}
              />
              <span className="relative h-4 w-4 rounded-full bg-accent shadow-[0_0_16px_rgba(0,212,255,0.9)]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[0.65rem] uppercase tracking-[0.3em] text-accent">
                {LABEL[state] ?? 'Senti'}
              </div>
              <div className="mt-1 truncate text-sm text-white/85">
                {detail || 'Say what you need.'}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
