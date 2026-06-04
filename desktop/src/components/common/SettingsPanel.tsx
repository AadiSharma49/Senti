import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../../state/uiStore'
import { useSettingsStore } from '../../state/settingsStore'
import { audioManager } from '../../services/audioManager'
import UnlockTrainingModal from '../training/UnlockTrainingModal'
import { useClapUnlockStore } from '../../state/clapUnlockStore'
import { useVoiceUnlockStore } from '../../state/voiceUnlockStore'


export default function SettingsPanel() {
  const open = useUiStore((s) => s.settingsOpen)
  const close = useUiStore((s) => s.closeSettings)

  const settings = useSettingsStore((s) => s)
  const setIdentity = useSettingsStore((s) => s.setIdentity)
  const setSecurity = useSettingsStore((s) => s.setSecurity)
  const setUnlockMethod = useSettingsStore((s) => s.setUnlockMethod)
  const clapEnabled = settings.unlockMethods.clap.enabled
  const resetClapProfile = useClapUnlockStore((s) => s.resetProfile)

  // unlock training state
  const [trainingModalOpen, setTrainingModalOpen] = useState(false)
  const clapStatus = useClapUnlockStore((s) => s.getStatus())
  const voiceStatus = useVoiceUnlockStore((s) => s.getStatus())
  const clapLastTrained = useClapUnlockStore((s) => s.getLastTrainedDate())
  const voiceLastTrained = useVoiceUnlockStore((s) => s.getLastTrainedDate())

  // identity form state
  const [username, setUsername] = useState(settings.identity.username)
  const [greetingName, setGreetingName] = useState(settings.identity.preferredName)
  const [title, setTitle] = useState(settings.identity.preferredTitle)

  // pin form
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMessage, setPinMessage] = useState<{ type: 'error' | 'success' | null; text: string | null }>({ type: null, text: null })

  // play open sound when panel mounts
  useEffect(() => {
    if (!open) return
    audioManager.play('panel-open')
    return () => {
      audioManager.play('panel-close')
    }
  }, [open])

  useEffect(() => {
    setUsername(settings.identity.username)
    setGreetingName(settings.identity.preferredName)
    setTitle(settings.identity.preferredTitle)
  }, [settings.identity])

  // identity save
  const saveIdentity = () => {
    if (!username || username.trim().length === 0) return
    setIdentity({ username: username.trim(), preferredName: greetingName.trim(), preferredTitle: title.trim() })
    audioManager.play('save')
  }

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
    audioManager.play('save')
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
          <div className="section-sub">Senti — Settings</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              saveIdentity()
              audioManager.play('save')
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
        <motion.section variants={sectionVariant} initial="hidden" animate="visible" className="">
          <h4 className="section-title">Identity</h4>
          <p className="section-sub mb-3">Your display name and how Senti addresses you.</p>
          <div className="grid gap-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={saveIdentity}
              placeholder="Username"
              className="input-glass"
            />
            <input
              value={greetingName}
              onChange={(e) => setGreetingName(e.target.value)}
              onBlur={saveIdentity}
              placeholder="Greeting Name (e.g., Aadi)"
              className="input-glass"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveIdentity}
              placeholder="Title (e.g., Sir)"
              className="input-glass"
            />
          </div>
        </motion.section>

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

        {/* Voice settings removed — replaced by sound effects system */}

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Unlock Methods</h4>
          <p className="section-sub mb-3">Configure your preferred unlocking methods.</p>
          <div className="grid gap-3">
            {/* PIN Unlock */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-white">🔐 PIN Unlock</div>
                  <div className="text-xs text-green-400 mt-1">✓ Configured</div>
                </div>
                <div className="text-xs text-secondary">Primary Backup</div>
              </div>
            </div>

            {/* Voice Unlock */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-white">🎤 Voice Unlock</div>
                  <div className={`text-xs mt-1 ${voiceStatus === 'trained' ? 'text-green-400' : 'text-secondary'}`}>
                    {voiceStatus === 'trained' ? '✓ Configured' : voiceStatus === 'needs-retrain' ? '⚠ Needs Retrain' : 'Not Configured'}
                  </div>
                  {voiceLastTrained && (
                    <div className="text-xs text-secondary mt-1">
                      Last trained: {voiceLastTrained.toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setTrainingModalOpen(true)}
                className="w-full mt-2 rounded-lg bg-accent/20 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/30 transition"
              >
                {voiceStatus === 'trained' ? 'Retrain' : 'Train Voice Phrase'}
              </button>
            </div>

            {/* Clap Unlock */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-white">👏 Clap Unlock</div>
                  <div className={`text-xs mt-1 ${clapStatus === 'trained' ? 'text-green-400' : clapStatus === 'needs-retrain' ? 'text-amber-400' : 'text-secondary'}`}>
                    {clapStatus === 'trained' ? '✓ Configured' : clapStatus === 'needs-retrain' ? '⚠ Needs Retrain' : 'Not Configured'}
                  </div>
                  {clapLastTrained && (
                    <div className="text-xs text-secondary mt-1">
                      Last trained: {clapLastTrained.toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={`inline-flex items-center gap-2 text-xs ${clapStatus !== 'trained' ? 'cursor-not-allowed text-white/40' : 'cursor-pointer text-secondary'}`}>
                    <input
                      type="checkbox"
                      checked={clapEnabled}
                      disabled={clapStatus !== 'trained'}
                      onChange={() => setUnlockMethod('clap', { ...settings.unlockMethods.clap, enabled: !clapEnabled })}
                      className="h-4 w-4 rounded border-white/10 bg-black/20 text-accent focus:ring-accent"
                    />
                    Enable
                  </label>
                </div>
              </div>
              <button
                onClick={() => setTrainingModalOpen(true)}
                className="w-full mt-2 rounded-lg bg-accent/20 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/30 transition"
              >
                {clapStatus === 'trained' ? 'Retrain' : 'Train Clap Pattern'}
              </button>
              {clapStatus === 'trained' && (
                <button
                  onClick={() => {
                    resetClapProfile()
                    setUnlockMethod('clap', { enabled: false, configured: false })
                    audioManager.play('denied')
                  }}
                  className="w-full mt-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-secondary hover:bg-white/10 transition"
                >
                  Remove Pattern
                </button>
              )}
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
      <UnlockTrainingModal isOpen={trainingModalOpen} onClose={() => setTrainingModalOpen(false)} />
    </AnimatePresence>
  )
}
