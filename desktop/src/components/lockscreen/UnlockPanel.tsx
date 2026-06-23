import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'
import { useSettingsStore } from '../../state/settingsStore'

export default function UnlockPanel() {
  const [showBackupPin, setShowBackupPin] = useState(false)
  const [pin, setPinInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { state, failedAttempts, verifyPin, enterPinEntry, lockoutUntil } = useLockStore()
  const settings = useSettingsStore((s) => s)
  const [shake, setShake] = useState(false)
  const [now, setNow] = useState(Date.now())

  const isFailed = state === 'failed'
  const isVerifying = state === 'verifying'
  const lockedActive = !!lockoutUntil && Date.now() < lockoutUntil

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showBackupPin) return
    const timer = window.setTimeout(() => { inputRef.current?.focus() }, 200)
    return () => clearTimeout(timer)
  }, [showBackupPin])

  const handleShowBackup = () => { setShowBackupPin(true); enterPinEntry() }
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (value.length > 0) enterPinEntry()
    setPinInput(value)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) handleSubmit()
  }
  const handleSubmit = () => {
    if (pin.length !== 4 || isVerifying) return
    if (lockedActive) return
    const success = verifyPin(pin)
    if (!success) { setPinInput(''); setShake(true); setTimeout(() => setShake(false), 500) }
    else { setPinInput('') }
  }

  const backupStatus = lockedActive
    ? 'Locked for ' + Math.max(0, Math.ceil((lockoutUntil! - now) / 1000)) + 's'
    : 'Enter your PIN to unlock.'

  return (
    <motion.div
      className="mt-12 flex w-full max-w-3xl flex-col items-center gap-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <motion.div
        className="w-full rounded-[32px] border border-white/10 bg-black/20 p-6 glass-strong shadow-2xl shadow-cyan-500/10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent">Unlock</div>
            <div className="text-2xl font-display mt-2">Senti is locked</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-5 ring-1 ring-white/5 shadow-lg shadow-cyan-700/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-white">PIN Access</div>
                <p className="text-sm text-secondary">Enter your PIN to unlock Senti.</p>
              </div>
              <button
                onClick={handleShowBackup}
                disabled={showBackupPin || lockedActive}
                className={'rounded-2xl px-4 py-2 text-sm font-semibold transition ' + (showBackupPin || lockedActive ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-accent text-black hover:bg-accent-glow')}
              >
                {showBackupPin ? 'Enter PIN' : 'Unlock'}
              </button>
            </div>
            <div className="mt-3 text-xs uppercase tracking-[0.3em] text-secondary">{backupStatus}</div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showBackupPin && (
          <motion.div
            key="backup-panel"
            className="w-full rounded-[32px] border border-white/10 bg-black/20 p-6 glass-strong shadow-2xl shadow-cyan-500/10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="flex flex-col items-center gap-6">
              <div className="w-full max-w-md text-center">
                <div className="text-xs uppercase tracking-[0.3em] text-accent">PIN</div>
                <div className="mt-2 text-sm text-secondary">Enter the 4-digit PIN you configured during setup.</div>
              </div>
              <motion.div
                className="relative w-full max-w-md"
                animate={shake ? { x: [-8, 8, -8, 8, 0] } : isVerifying ? { scale: [1, 0.995, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                <input
                  ref={inputRef}
                  type="password"
                  value={pin}
                  onChange={handlePinChange}
                  onKeyDown={handleKeyDown}
                  maxLength={4}
                  className={'w-full rounded-3xl border px-6 py-5 text-center text-4xl text-white font-mono tracking-[1.4em] bg-black/40 outline-none transition-all duration-300 ' + (isFailed ? 'border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20' : 'border-accent-muted focus:border-accent focus:ring-2 focus:ring-accent/20')}
                  placeholder="...."
                  aria-label="Enter PIN"
                  disabled={isVerifying || lockedActive}
                />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-between px-10 -translate-y-1/2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="h-4 w-4 rounded-full"
                      initial={{ scale: 0.9, opacity: 0.6 }}
                      animate={i < pin.length ? { scale: [0.9, 1.18, 1], opacity: 1 } : { scale: 1, opacity: 0.25 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      style={{
                        background: isFailed
                          ? (i < pin.length ? 'rgb(255,96,96)' : 'rgba(255,96,96,0.18)')
                          : (i < pin.length ? 'rgb(0,212,255)' : 'rgba(0,212,255,0.18)'),
                        boxShadow: i < pin.length && !isFailed
                          ? '0 0 14px rgba(0,212,255,0.85)'
                          : i < pin.length && isFailed
                          ? '0 0 14px rgba(255,96,96,0.9)'
                          : 'none'
                      }}
                    />
                  ))}
                </div>
              </motion.div>
              <motion.button
                onClick={handleSubmit}
                disabled={pin.length !== 4 || isVerifying || lockedActive}
                className={'w-full max-w-md rounded-3xl px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] transition ' + (pin.length === 4 && !isVerifying && !lockedActive ? 'bg-accent text-black hover:bg-accent-glow shadow-lg shadow-accent/20' : 'bg-white/10 text-white/40 cursor-not-allowed')}
                whileHover={pin.length === 4 && !lockedActive ? { scale: 1.02 } : {}}
                whileTap={pin.length === 4 && !lockedActive ? { scale: 0.98 } : {}}
              >
                {isVerifying ? 'Unlocking...' : 'Unlock'}
              </motion.button>
              <div className="text-xs uppercase tracking-[0.3em] text-secondary">
                {isFailed ? failedAttempts + ' failed attempt' + (failedAttempts === 1 ? '' : 's') : 'Your PIN is stored locally.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}