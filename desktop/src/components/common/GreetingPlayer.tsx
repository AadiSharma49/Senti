import React, { useEffect, useRef } from 'react'
import { useLockStore } from '../../state/lockStore'
import { audioManager } from '../../services/audioManager'

const STARTUP_PLAYED = '__senti_startup_played'

export default function GreetingPlayer() {
  const { state, setSpeaking, lock } = useLockStore()
  const cancelled = useRef(false)

  useEffect(() => {
    if (state !== 'greeting') return

    if ((window as any)[STARTUP_PLAYED]) return
    ;(window as any)[STARTUP_PLAYED] = true

    cancelled.current = false
    let mounted = true

    const run = async () => {
      try {
        audioManager.preload()
        setSpeaking(true)
        audioManager.play('startup')
        // short pause to allow audio to register visually
        setTimeout(() => {
          if (!mounted) return
          setSpeaking(false)
          if (!cancelled.current) lock()
        }, 600)
      } catch {
        setTimeout(() => {
          try { if (!cancelled.current) lock() } catch {}
        }, 200)
      }
    }

    run()

    return () => {
      mounted = false
      cancelled.current = true
      try { audioManager.stop('startup') } catch {}
    }
  }, [state, setSpeaking, lock])

  return null
}
