import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Background from '../common/Background'
import StarField from '../common/StarField'
import Visualizer from '../visualizer/Visualizer'
import UnlockPanel from './UnlockPanel'
import SettingsButton from '../common/SettingsButton'
import SettingsPanel from '../common/SettingsPanel'
import SentiAssistant from '../assistant/SentiAssistant'
import { useLockStore } from '../../state/lockStore'
import { useVoiceAuthStore } from '../../state/voiceAuthStore'
import { useAssistantStore } from '../../state/assistantStore'
import { useUiStore } from '../../state/uiStore'
import { useGreetingStore } from '../../state/greetingStore'
import { audioManager } from '../../services/audioManager'
import { warmModels } from '../../services/warmup'

export default function LockScreen() {
  const { state, lock } = useLockStore()
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const greeting = useGreetingStore((s) => s.text)

  const enterDesktop = () => {
    try {
      window.close()
    } catch {}
  }

  useEffect(() => {
    // Boot sequence: brief boot -> preload sounds -> lock
    useLockStore.getState().startBoot()
    // Load the ML models now, while the user is still reading the lock screen,
    // so the first unlock and the first question don't pay a cold start.
    warmModels()
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

    // Speak the AI greeting, then open the assistant so the user can talk to
    // Senti. The user leaves to the desktop with the "Enter desktop" button
    // (window stays until then — this IS the lock screen).
    let cancelled = false
    useGreetingStore
      .getState()
      .greet()
      .finally(() => {
        if (!cancelled) setTimeout(() => useAssistantStore.getState().show(), 400)
      })

    return () => {
      cancelled = true
      useGreetingStore.getState().reset()
      useAssistantStore.getState().hide()
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
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <button
                  onClick={() => useAssistantStore.getState().show()}
                  className="rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-accent-glow"
                >
                  Talk to Senti
                </button>
                <button
                  onClick={enterDesktop}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Enter desktop
                </button>
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
                <button
                  onClick={() => useAssistantStore.getState().show()}
                  className="text-xs uppercase tracking-[0.3em] text-secondary transition hover:text-accent"
                >
                  Talk to Senti
                </button>
            </motion.div>
          )}
        </AnimatePresence>

        <SettingsButton />
        <SettingsPanel />
      </div>

      <SentiAssistant />
    </motion.div>
  )
}