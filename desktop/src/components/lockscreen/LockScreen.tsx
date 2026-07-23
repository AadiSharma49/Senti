import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import Background from '../common/Background'
import StarField from '../common/StarField'
import Visualizer from '../visualizer/Visualizer'
import UnlockPanel from './UnlockPanel'
import SettingsButton from '../common/SettingsButton'
import SettingsPanel from '../common/SettingsPanel'
import { useLockStore } from '../../state/lockStore'
import { useVoiceAuthStore } from '../../state/voiceAuthStore'
import { useUiStore } from '../../state/uiStore'
import { audioManager } from '../../services/audioManager'
import { warmModels } from '../../services/warmup'

/**
 * Sign-in — shown once when Senti starts, so it knows it's really you before it
 * acts. NOT a lock screen: after you sign in, App hands off to the tray/orb.
 * The whole "unlocked" experience now lives elsewhere, so this screen only has
 * one job — recognise you — and it should feel like meeting an assistant, not
 * clearing a security gate.
 */
export default function LockScreen() {
  const state = useLockStore((s) => s.state)
  const lock = useLockStore((s) => s.lock)
  const settingsOpen = useUiStore((s) => s.settingsOpen)

  useEffect(() => {
    useLockStore.getState().startBoot()
    warmModels()
    const t = setTimeout(() => {
      audioManager.preload()
      lock()
    }, 500)
    return () => clearTimeout(t)
  }, [lock])

  // Release the mic if Settings opens or we move on.
  useEffect(() => {
    const voice = useVoiceAuthStore.getState()
    if (settingsOpen || state === 'unlocked' || state === 'lockout') {
      if (voice.state !== 'idle' && voice.state !== 'matched') voice.stopSession()
    }
    return () => useVoiceAuthStore.getState().stopSession()
  }, [state, settingsOpen])

  return (
    <motion.div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      <Background />
      <StarField />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Hero: the orb + wordmark */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="scale-90">
            <Visualizer />
          </div>
          <motion.div
            className="-mt-4 flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            <div className="font-display text-4xl font-semibold tracking-[0.12em] text-white text-glow">
              SENTI
            </div>
            <div className="text-[0.62rem] uppercase tracking-[0.42em] text-accent/90">
              Your voice is the key
            </div>
          </motion.div>
        </motion.div>

        {/* Sign-in */}
        <motion.div
          className="mt-8 w-full"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.55, ease: 'easeOut' }}
        >
          <UnlockPanel />
        </motion.div>
      </div>

      <SettingsButton />
      <SettingsPanel />
    </motion.div>
  )
}
