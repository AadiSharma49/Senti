import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '../../state/settingsStore'
import AccountStep from './AccountStep'
import { useDeviceStore } from '../../state/deviceStore'

export default function SetupWizard() {
  const setSetupCompleted = useSettingsStore((s) => s.setSetupCompleted)
  const deviceLinked = useDeviceStore((s) => s.linked)

  const [step, setStep] = useState(0)

  // Account FIRST: the pairing token is what makes Sentinel able to greet you
  // and think at all. Skipping it fails silently later.
  const stepLabels = ['Account', 'Review', 'Finish']
  const progress = useMemo(() => (step / (stepLabels.length - 1)) * 100, [step, stepLabels.length])

  const handleNext = () => {
    setStep((current) => Math.min(current + 1, stepLabels.length - 1))
  }

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0))
  }

  const handleFinish = () => {
    setSetupCompleted(true)
    setStep(stepLabels.length - 1)
  }

  const currentTitle = step === 0 ? 'Your Account' : step === 1 ? 'Review' : 'Complete'

  return (
    <motion.div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div className="glass-strong border border-white/10 z-10 w-full max-w-3xl p-8 md:p-12 rounded-[32px] backdrop-blur-xl text-white">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.3em] text-accent">First-Time Setup</div>
                <h1 className="text-3xl font-display">Welcome to Sentinel</h1>
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
                  <motion.div key="account" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <AccountStep onLinked={() => setStep(1)} />
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <p className="text-sm text-secondary mb-6">One last look before you start talking to it.</p>
                    <div className="grid gap-4">
                      <div className="glass rounded-3xl border border-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Account</div>
                        <div className="text-sm text-white/80">
                          {deviceLinked
                            ? 'Linked — Sentinel knows you, and the assistant can answer.'
                            : 'Not linked — the assistant will not work until you link this device.'}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="complete" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <div className="text-lg font-semibold text-white">Setup complete</div>
                    <p className="text-sm text-secondary mt-3">Sentinel is ready and listening. Say &ldquo;hey Sentinel&rdquo; — or just give it an order like &ldquo;open Chrome&rdquo; — from anywhere.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-secondary">
                {stepLabels.map((label, index) => (
                  <span key={label} className={`rounded-full px-3 py-1 ${index === step ? 'bg-accent text-black' : 'bg-white/5 text-white/70'}`}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {step > 0 && step < 2 && (
                  <button onClick={handleBack} className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5 transition">Back</button>
                )}
                {step === 0 && (
                  <button onClick={handleNext} className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition">
                    {deviceLinked ? 'Next' : 'Skip (assistant stays off)'}
                  </button>
                )}
                {step === 1 && (
                  <button onClick={handleFinish} className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition">Finish Setup</button>
                )}
                {step === 2 && (
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
