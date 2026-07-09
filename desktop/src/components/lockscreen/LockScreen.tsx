import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Background from '../common/Background'
import StarField from '../common/StarField'
import Visualizer from '../visualizer/Visualizer'
import UnlockPanel from './UnlockPanel'
import SettingsButton from '../common/SettingsButton'
import SettingsPanel from '../common/SettingsPanel'
import { useLockStore } from '../../state/lockStore'
import { useVoiceAuthStore } from '../../state/voiceAuthStore'
import { useUiStore } from '../../state/uiStore'
import { useGreetingStore } from '../../state/greetingStore'
import { audioManager } from '../../services/audioManager'

export default function LockScreen() {
  const { state, lock } = useLockStore()
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const greeting = useGreetingStore((s) => s.text)

  useEffect(() => {
    // Boot sequence: brief boot -> preload sounds -> lock
    useLockStore.getState().startBoot()
    const t = setTimeout(() => {
      audioManager.preload()
      lock()
    }, 600)
    return () => clearTimeout(t)
  }, [lock])

  // Voice unlock is click-to-listen (started from the button), never
  // auto-started. Just make sure the mic is released when the settings
  // panel opens or the screen unlocks/locks out.
  useEffect(() => {
    const voice = useVoiceAuthStore.getState()
    if (settingsOpen || state === 'unlocked' || state === 'lockout') {
      if (voice.state !== 'idle' && voice.state !== 'matched') voice.stopSession()
    }
  }, [state, settingsOpen])

  useEffect(() => {
    return () => {
      useVoiceAuthStore.getState().stopSession()
    }
  }, [])

  useEffect(() => {
    if (state !== 'unlocked') return

    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      try {
        window.close()
      } catch {}
    }

    // Speak the AI greeting, then close shortly after it finishes.
    // A hard cap guarantees the window always closes even if TTS stalls.
    const hardCap = setTimeout(close, 9000)
    useGreetingStore
      .getState()
      .greet()
      .finally(() => {
        setTimeout(close, 500)
      })

    return () => {
      clearTimeout(hardCap)
      useGreetingStore.getState().reset()
    }
  }, [state])

  return (
    <motion.div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeInOut' }}
    >
      <Background />
      <StarField />

      <div className="z-10 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {state === 'unlocked' ? (
            <motion.div
              key="unlocked"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="flex flex-col items-center gap-8"
            >
              <Visualizer />
              <motion.div
                className="text-accent text-xs uppercase tracking-[0.3em]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                Unlocked
              </motion.div>
              <motion.div
                key={greeting}
                className="max-w-xl px-6 text-center text-2xl font-display text-white text-glow"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {greeting || 'Welcome back.'}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="locked"
              initial={{ opacity: 1, scale: 1 }}
              animate={{
                opacity: 1,
                scale: state === 'failed' ? [1, 1.02, 0.98, 1] : 1,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-12"
            >
                <Visualizer />
                <UnlockPanel />
            </motion.div>
          )}
        </AnimatePresence>

        <SettingsButton />
        <SettingsPanel />
      </div>
    </motion.div>
  )
}