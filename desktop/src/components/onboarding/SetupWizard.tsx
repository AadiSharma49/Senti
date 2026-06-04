import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '../../state/settingsStore'

const identityRules = {
  username: { min: 2, max: 24 },
  greetingName: { min: 1, max: 20 },
  title: { min: 1, max: 20 },
}

const isNumeric = (value: string) => /^[0-9]*$/.test(value)

export default function SetupWizard() {
  const settings = useSettingsStore((s) => s)
  const setIdentity = useSettingsStore((s) => s.setIdentity)
  const setSecurity = useSettingsStore((s) => s.setSecurity)
  const setSetupCompleted = useSettingsStore((s) => s.setSetupCompleted)

  const [step, setStep] = useState(0)
  const [username, setUsername] = useState(settings.identity.username || '')
  const [greetingName, setGreetingName] = useState(settings.identity.preferredName || '')
  const [title, setTitle] = useState(settings.identity.preferredTitle || '')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const stepLabels = ['Identity', 'Security', 'Review', 'Finish']
  const progress = useMemo(() => (step / (stepLabels.length - 1)) * 100, [step, stepLabels.length])

  const validateIdentity = () => {
    if (!username.trim()) return 'Username cannot be empty.'
    if (username.trim().length < identityRules.username.min) return 'Username is too short.'
    if (username.trim().length > identityRules.username.max) return 'Username is too long.'
    if (!greetingName.trim()) return 'Greeting Name cannot be empty.'
    if (greetingName.trim().length > identityRules.greetingName.max) return 'Greeting Name is too long.'
    if (!title.trim()) return 'Title cannot be empty.'
    if (title.trim().length > identityRules.title.max) return 'Title is too long.'
    return null
  }

  const validateSecurity = () => {
    if (!pin || pin.length < 4) return 'PIN must be at least 4 digits.'
    if (!isNumeric(pin)) return 'PIN can only contain numbers.'
    if (pin !== confirmPin) return 'PIN entries do not match.'
    return null
  }

  const handleNext = () => {
    setError(null)
    if (step === 0) {
      const validation = validateIdentity()
      if (validation) {
        setError(validation)
        return
      }
    }
    if (step === 1) {
      const validation = validateSecurity()
      if (validation) {
        setError(validation)
        return
      }
    }
    setStep((current) => Math.min(current + 1, stepLabels.length - 1))
  }

  const handleBack = () => {
    setError(null)
    setStep((current) => Math.max(current - 1, 0))
  }

  const handleFinish = () => {
    setError(null)
    const identityError = validateIdentity()
    const securityError = validateSecurity()
    if (identityError || securityError) {
      setError(identityError || securityError)
      setStep(identityError ? 0 : 1)
      return
    }

    setIdentity({ username: username.trim(), preferredName: greetingName.trim(), preferredTitle: title.trim() })
    setSecurity({ pin })
    setSetupCompleted(true)
    setStep(stepLabels.length - 1)
  }

  const currentTitle = step === 0 ? 'Identity' : step === 1 ? 'Security' : step === 2 ? 'Review' : 'Complete'

  return (
    <motion.div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.15),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(103,232,255,0.12),_transparent_30%)]" />
      <div className="glass-strong border border-white/10 shadow-2xl shadow-cyan-500/10 z-10 w-full max-w-3xl p-8 md:p-12 rounded-[32px] backdrop-blur-xl text-white">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.3em] text-accent">First-Time Setup</div>
                <h1 className="text-3xl font-display">Welcome to Senti</h1>
              </div>
              <div className="text-right text-xs uppercase tracking-[0.2em] text-secondary">Step {step + 1} / {stepLabels.length}</div>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-accent" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-3xl border border-white/10 p-6 bg-black/20">
              <div className="text-accent text-xs uppercase tracking-[0.3em] mb-2">{currentTitle}</div>
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key="identity" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <p className="text-sm text-secondary mb-6">Create the identity Senti will recognize and address.</p>
                    <div className="grid gap-4">
                      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="input-glass" />
                      <input value={greetingName} onChange={(e) => setGreetingName(e.target.value)} placeholder="Greeting Name" className="input-glass" />
                      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input-glass" />
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div key="security" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <p className="text-sm text-secondary mb-6">Choose a secure PIN for quick access to Senti.</p>
                    <div className="grid gap-4">
                      <input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="PIN" className="input-glass" />
                      <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Confirm PIN" className="input-glass" />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <p className="text-sm text-secondary mb-6">Review your secure setup before finishing.</p>
                    <div className="grid gap-4">
                      <div className="glass rounded-3xl border border-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Identity Summary</div>
                        <div className="grid gap-2 text-sm text-white/80">
                          <div><span className="text-secondary">Username:</span> {username || '—'}</div>
                          <div><span className="text-secondary">Greeting Name:</span> {greetingName || '—'}</div>
                          <div><span className="text-secondary">Title:</span> {title || '—'}</div>
                        </div>
                      </div>
                      <div className="glass rounded-3xl border border-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Security</div>
                        <div className="text-sm text-white/80">PIN is configured and kept secure locally.</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="complete" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <div className="text-lg font-semibold text-white">Setup complete</div>
                    <p className="text-sm text-secondary mt-3">Senti is ready. Your settings are now stored locally and the lockscreen will return automatically.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">{error}</div>}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-secondary">
                {stepLabels.map((label, index) => (
                  <span key={label} className={`rounded-full px-3 py-1 ${index === step ? 'bg-accent text-black' : 'bg-white/5 text-white/70'}`}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {step > 0 && step < 3 && (
                  <button onClick={handleBack} className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5 transition">Back</button>
                )}
                {step < 2 && (
                  <button onClick={handleNext} className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition">Next</button>
                )}
                {step === 2 && (
                  <button onClick={handleFinish} className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition">Finish Setup</button>
                )}
                {step === 3 && (
                  <button onClick={() => setSetupCompleted(true)} className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition">Continue</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
