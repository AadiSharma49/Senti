import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../../state/uiStore'
import { useSettingsStore } from '../../state/settingsStore'

export default function SettingsPanel() {
  const open = useUiStore((s) => s.settingsOpen)
  const close = useUiStore((s) => s.closeSettings)

  const settings = useSettingsStore((s) => s)
  const setSecurity = useSettingsStore((s) => s.setSecurity)

  // pin form
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMessage, setPinMessage] = useState<{ type: 'error' | 'success' | null; text: string | null }>({ type: null, text: null })

  const changePin = () => {
    setPinMessage({ type: null, text: null })
    const stored = settings.security.pin
    if (currentPin !== stored) {
      setPinMessage({ type: 'error', text: 'Current PIN is incorrect' })
      return
    }
    if (!newPin || newPin.length === 0) {
      setPinMessage({ type: 'error', text: 'New PIN cannot be empty' })
      return
    }
    if (newPin !== confirmPin) {
      setPinMessage({ type: 'error', text: 'New PIN and confirmation do not match' })
      return
    }

    setSecurity({ pin: newPin })
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setPinMessage({ type: 'success', text: 'PIN updated' })
  }

  const sectionVariant = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0 },
  }

  const panel = (
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.45, ease: 'circOut' }}
      className="fixed top-0 right-0 h-full w-full md:w-96 z-50 p-6 flex flex-col gap-4 text-white"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="glass-strong p-4 rounded-lg flex items-center justify-between">
        <div>
          <div className="section-title text-lg">Control Center</div>
          <div className="section-sub">Senti - Settings</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              close()
            }}
            className="px-3 py-1 rounded-md bg-accent text-black glow-ring"
          >
            Save & Close
          </button>
          <button onClick={close} className="px-3 py-1 rounded-md glass-hoverable">Close</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/40 scrollbar-track-slate-900/50">
        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Security</h4>
          <p className="section-sub mb-3">Change your PIN. Senti stores PIN locally only.</p>
          <div className="grid gap-3">
            <input
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="Current PIN"
              type="password"
              className="input-glass"
            />
            <input
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="New PIN"
              type="password"
              className="input-glass"
            />
            <input
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Confirm New PIN"
              type="password"
              className="input-glass"
            />
            <div className="flex items-center gap-3">
              <button onClick={changePin} className="px-3 py-1 rounded-md bg-accent text-black glow-ring">Change PIN</button>
              <div className={`text-sm ${pinMessage.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                {pinMessage.text}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Unlock Methods</h4>
          <p className="section-sub mb-3">Senti uses PIN-based unlock.</p>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-white">PIN Unlock</div>
                  <div className="text-xs text-green-400 mt-1">Configured</div>
                </div>
                <div className="text-xs text-secondary">Primary</div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </motion.aside>
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={close}
          />
          {panel}
        </>
      )}
    </AnimatePresence>
  )
}