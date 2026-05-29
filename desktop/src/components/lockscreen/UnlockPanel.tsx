import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'

export default function UnlockPanel() {
  const [pin, setPinInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { state, failedAttempts, unlock, resetFailedAttempts, username, enterTyping, cooldownUntil } = useLockStore()
  const [shake, setShake] = useState(false)
  const isUnlocking = state === 'unlocking'
  const isFailed = state === 'failed_attempt'
  const [now, setNow] = useState(Date.now())
  const lockedActive = !!cooldownUntil && Date.now() < cooldownUntil

  useEffect(() => {
    if (state === 'locked' || state === 'failed_attempt' || state === 'typing_pin') {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [state])

  // keep a ticking clock to render lockout countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (value.length > 0) enterTyping()
    setPinInput(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) {
      handleSubmit()
    }
    // Backspace and digit input are handled by the native input change
  }

  const handleSubmit = () => {
    if (pin.length !== 4 || isUnlocking) return
    if (cooldownUntil && Date.now() < cooldownUntil) return
    const result = unlock(pin)
    if (result === 'failed') {
      setPinInput('')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } else if (result === 'success') {
      setPinInput('')
      // input is disabled while unlocking; visual transition handled by store
    }
  }

  return (
    <motion.div
      className="mt-12 flex flex-col items-center gap-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Minimal greeting */}
      <motion.p
        className="text-secondary text-sm uppercase tracking-widest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {username}
      </motion.p>

      {/* PIN Input */}
      <motion.div
        className="relative w-72 h-16"
        animate={shake ? { x: [-8, 8, -8, 8, 0] } : isUnlocking ? { scale: [1, 0.995, 1] } : {}}
        transition={{ duration: 0.4 }}
      >
        <input
          ref={inputRef}
          type="password"
          value={pin}
          onChange={handlePinChange}
          onKeyDown={handleKeyDown}
          maxLength={4}
          className={`absolute inset-0 w-full h-full bg-transparent rounded-2xl text-center text-4xl text-primary font-mono tracking-[1.2em] focus:outline-none transition-all duration-300 ${isFailed ? 'border border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20' : 'border border-accent-muted focus:border-accent focus:ring-2 focus:ring-accent/20'}`}
          placeholder="••••"
          aria-label="Enter PIN"
          autoFocus
          disabled={isUnlocking || lockedActive}
        />
        {/* Animated dot indicators */}
        <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-between px-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-4 h-4 rounded-full transition-all duration-200"
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={
                i < pin.length
                  ? { scale: [0.9, 1.18, 1], opacity: 1 }
                  : { scale: 1, opacity: 0.35 }
              }
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{
                background: isFailed
                  ? i < pin.length
                    ? 'rgb(255,96,96)'
                    : 'rgba(255,96,96,0.18)'
                  : i < pin.length
                  ? 'rgb(0,212,255)'
                  : 'rgba(0,212,255,0.18)',
                boxShadow:
                  i < pin.length && !isFailed
                    ? '0 0 14px rgba(0,212,255,0.85)'
                    : i < pin.length && isFailed
                    ? '0 0 14px rgba(255,96,96,0.9)'
                    : 'none',
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {(state === 'failed_attempt' || lockedActive) && (
          <motion.div
            className="text-accent text-xs uppercase tracking-wider"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {lockedActive
              ? `Locked for ${Math.max(0, Math.ceil((cooldownUntil! - now) / 1000))}s`
              : failedAttempts === 1
                ? 'Incorrect PIN'
                : `${failedAttempts} attempts`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit button */}
      <motion.button
        onClick={handleSubmit}
        disabled={pin.length !== 4 || isUnlocking}
        className={`px-10 py-3 rounded-2xl font-mono text-xs uppercase tracking-wider transition-all duration-300 ${
          pin.length === 4 && !isUnlocking
            ? 'bg-accent text-bg-primary hover:bg-accent-glow shadow-lg shadow-accent/20 cursor-pointer'
            : 'bg-accent/10 text-accent-muted cursor-not-allowed'
        }`}
        whileHover={pin.length === 4 ? { scale: 1.05 } : {}}
        whileTap={pin.length === 4 ? { scale: 0.98 } : {}}
      >
        {isUnlocking ? 'Unlocking...' : 'Unlock'}
      </motion.button>
    </motion.div>
  )
}
