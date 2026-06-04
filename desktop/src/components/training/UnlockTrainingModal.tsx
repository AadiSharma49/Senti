import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ClapTraining from './ClapTraining'
import VoiceTraining from './VoiceTraining'
import VoiceTrainingErrorBoundary from './VoiceTrainingErrorBoundary'
import { useClapUnlockStore } from '../../state/clapUnlockStore'
import { useVoiceUnlockStore } from '../../state/voiceUnlockStore'

interface UnlockTrainingModalProps {
  isOpen: boolean
  onClose: () => void
}

type TrainingMethod = 'voice' | 'clap' | null

export default function UnlockTrainingModal({ isOpen, onClose }: UnlockTrainingModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<TrainingMethod>(null)
  const clapStatus = useClapUnlockStore((s) => s.getStatus())
  const voiceStatus = useVoiceUnlockStore((s) => s.getStatus())

  const handleMethodSelect = (method: TrainingMethod) => {
    setSelectedMethod(method)
  }

  const handleClose = () => {
    setSelectedMethod(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-x-4 top-10 z-50 max-h-[85vh] w-auto max-w-2xl transform overflow-y-auto rounded-[32px] border border-white/10 bg-black/80 p-6 glass-strong shadow-2xl shadow-cyan-500/10"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-accent">Training Mode</div>
                <h2 className="text-2xl font-display mt-2">
                  {selectedMethod === null ? 'Choose Training Method' : selectedMethod === 'voice' ? 'Voice Unlock Training' : 'Clap Unlock Training'}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-white/10 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {selectedMethod === null && (
              <div className="space-y-4">
                <motion.button
                  onClick={() => handleMethodSelect('voice')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-left hover:border-accent hover:bg-accent/10 transition"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white">🎤 Voice Unlock</div>
                      <div className={`text-xs mt-1 ${voiceStatus === 'trained' ? 'text-green-400' : 'text-secondary'}`}>
                        {voiceStatus === 'trained' ? '✓ Configured' : voiceStatus === 'needs-retrain' ? 'Needs Retrain' : 'Not Configured'}
                      </div>
                    </div>
                    <div className="text-2xl">→</div>
                  </div>
                </motion.button>

                <motion.button
                  onClick={() => handleMethodSelect('clap')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-left hover:border-accent hover:bg-accent/10 transition"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white">👏 Clap Unlock</div>
                      <div className={`text-xs mt-1 ${clapStatus === 'trained' ? 'text-green-400' : 'text-secondary'}`}>
                        {clapStatus === 'trained' ? '✓ Configured' : clapStatus === 'needs-retrain' ? 'Needs Retrain' : 'Not Configured'}
                      </div>
                    </div>
                    <div className="text-2xl">→</div>
                  </div>
                </motion.button>

                <button
                  onClick={handleClose}
                  className="w-full rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition"
                >
                  Close
                </button>
              </div>
            )}

            {selectedMethod === 'voice' && (
              <div>
                <VoiceTrainingErrorBoundary>
                  <VoiceTraining />
                </VoiceTrainingErrorBoundary>
                <button
                  onClick={() => setSelectedMethod(null)}
                  className="mt-6 w-full rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition"
                >
                  Back to Methods
                </button>
              </div>
            )}

            {selectedMethod === 'clap' && (
              <div>
                <ClapTraining />
                <button
                  onClick={() => setSelectedMethod(null)}
                  className="mt-6 w-full rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition"
                >
                  Back to Methods
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
