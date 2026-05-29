import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Background from '../common/Background'
import ParticleField from '../common/ParticleField'
import Visualizer from '../visualizer/Visualizer'
import UnlockPanel from './UnlockPanel'
// Wallpaper functionality paused temporarily (hidden)
// import WallpaperPicker from './WallpaperPicker'
import GreetingPlayer from '../common/GreetingPlayer'
import SettingsButton from '../common/SettingsButton'
import SettingsPanel from '../common/SettingsPanel'
import { useLockStore } from '../../state/lockStore'
import { useEffect } from 'react'

export default function LockScreen() {
  const { state } = useLockStore()

  const { startBoot, startGreeting } = useLockStore()

  useEffect(() => {
    // Boot sequence: brief boot -> greeting (greeting handles session once-per-session)
    startBoot()
    const t = setTimeout(() => {
      startGreeting()
    }, 600)
    return () => clearTimeout(t)
  }, [startBoot, startGreeting])

  useEffect(() => {
    if (state === 'unlocked') {
      // allow the fade animation to complete then close the window
      const t = setTimeout(() => {
        try {
          // prefer electron API if available
          // @ts-ignore
          if (window.senti && typeof window.senti.lock === 'function') {
            // closing via main process may be preferable
            // @ts-ignore
            window.close()
          } else {
            window.close()
          }
        } catch {}
      }, 900)
      return () => clearTimeout(t)
    }
  }, [state])

  return (
    <motion.div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: state === 'unlocked' ? 0 : 1 }}
      transition={{ duration: 0.9, ease: 'easeInOut' }}
    >
      <Background />
      <ParticleField />

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
                className="text-accent text-xl font-display"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                System unlocked
              </motion.div>
              <motion.div
                className="text-secondary text-sm uppercase tracking-widest"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                Press any key to lock
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="locked"
              initial={{ opacity: 1, scale: 1 }}
              animate={{
                opacity: 1,
                scale: state === 'failed_attempt' ? [1, 1.02, 0.98, 1] : 1,
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

        <GreetingPlayer />
        <SettingsButton />
        <SettingsPanel />
      </div>
    </motion.div>
  )
}
