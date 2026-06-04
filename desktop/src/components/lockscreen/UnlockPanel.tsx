import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLockStore } from '../../state/lockStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useClapUnlockStore } from '../../state/clapUnlockStore'
import { useVoiceUnlockStore } from '../../state/voiceUnlockStore'
import { microphoneCapture } from '../../services/microphoneCapture'
import { audioAnalyzer } from '../../services/audioAnalyzer'
import { ClapDetectionEngine } from '../../services/clapDetectionEngine'
import { LiveVoiceCapture } from '../../services/liveVoiceCapture'
import { compareVoicePhrase } from '../../services/voiceValidationService'

const futureMethods = [
  {
    id: 'voice',
    label: 'Voice Unlock',
    status: 'Coming Soon',
    description: 'Unlock Senti with natural voice commands once available.',
  },
  {
    id: 'clap',
    label: 'Clap Unlock',
    status: 'Coming Soon',
    description: 'Trigger access with a subtle clap pattern in future releases.',
  },
]

export default function UnlockPanel() {
  const [showBackupPin, setShowBackupPin] = useState(false)
  const [pin, setPinInput] = useState('')
  const [clapMessage, setClapMessage] = useState('Clap unlock is not active.')
  const [clapListening, setClapListening] = useState(false)
  const [clapFeedback, setClapFeedback] = useState<'ready' | 'validating' | 'matched' | 'failed' | 'disabled'>('disabled')
  const inputRef = useRef<HTMLInputElement>(null)
  const engineRef = useRef<ClapDetectionEngine | null>(null)
  const listenerTimeoutRef = useRef<number | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)
  const { state, failedAttempts, unlock, enterTyping, lockoutUntil, unlockWithVoice } = useLockStore()
  const unlockMethods = useSettingsStore((s) => s.unlockMethods)
  const clapProfile = useClapUnlockStore((s) => s.profile)
  const voiceProfile = useVoiceUnlockStore((s) => s.profile)
  const [shake, setShake] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'matched' | 'failed' | 'disabled'>('disabled')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceConfidence, setVoiceConfidence] = useState(0)
  const [voiceSimilarity, setVoiceSimilarity] = useState(0)
  const [voiceLanguage, setVoiceLanguage] = useState('en')
  const [voiceReason, setVoiceReason] = useState('Waiting for voice input')
  const [voiceBackendConnected, setVoiceBackendConnected] = useState(false)
  const [voiceModelLoaded, setVoiceModelLoaded] = useState(false)
  const [voiceDeviceLabel, setVoiceDeviceLabel] = useState('Default microphone')
  const voiceCaptureRef = useRef<LiveVoiceCapture | null>(null)
  const voiceTriggeredRef = useRef(false)
  const [now, setNow] = useState(Date.now())
  const isUnlocking = state === 'unlocking'
  const isFailed = state === 'failed_attempt'
  const lockedActive = !!lockoutUntil && Date.now() < lockoutUntil

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showBackupPin) return
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 200)
    return () => clearTimeout(timer)
  }, [showBackupPin])

  useEffect(() => {
    return () => {
      stopClapListener()
      stopVoiceListener()
    }
  }, [])

  const handleShowBackup = () => {
    setShowBackupPin(true)
    enterTyping()
  }

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (value.length > 0) enterTyping()
    setPinInput(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (pin.length !== 4 || isUnlocking) return
    if (lockedActive) return
    const result = await unlock(pin)
    if (result === 'failed') {
      setPinInput('')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } else if (result === 'success') {
      setPinInput('')
    }
  }

  const clapEnabled = unlockMethods?.clap?.enabled && !!clapProfile?.primaryPattern?.clapCount
  const voiceEnabled = unlockMethods?.voice?.enabled && !!voiceProfile?.primaryPhrase

  const stopClapListener = () => {
    if (listenerTimeoutRef.current) {
      window.clearTimeout(listenerTimeoutRef.current)
      listenerTimeoutRef.current = null
    }
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    if (engineRef.current) {
      engineRef.current.dispose()
      engineRef.current = null
    }
    audioAnalyzer.dispose()
    microphoneCapture.stop()
    setClapListening(false)
  }

  const stopVoiceListener = () => {
    voiceCaptureRef.current?.stop()
    voiceCaptureRef.current = null
    setVoiceStatus('idle')
    setVoiceTranscript('')
    setVoiceConfidence(0)
    setVoiceReason('Voice capture stopped')
  }

  const startVoiceListener = async () => {
    if (!voiceEnabled || state !== 'locked' || lockedActive) {
      return
    }

    stopVoiceListener()
    setVoiceStatus('listening')
    setVoiceReason('Listening for your trained phrase...')
    setVoiceTranscript('')
    setVoiceConfidence(0)

    const capture = new LiveVoiceCapture()
    voiceCaptureRef.current = capture

    const unsubscribeStatus = capture.onBackendStatus((data: any) => {
      const connected = Boolean(data?.backendConnected)
      const loaded = Boolean(data?.modelLoaded)
      setVoiceBackendConnected(connected)
      setVoiceModelLoaded(loaded)
      if (data?.backendConnected === false) {
        setVoiceReason('Voice backend disconnected')
      }
    })

    capture.onTranscript((transcript, confidence, language) => {
      setVoiceTranscript(transcript)
      setVoiceConfidence(confidence ?? 0)
      setVoiceLanguage(language ?? 'en')

      if (!voiceProfile?.primaryPhrase) {
        return
      }

      const comparison = compareVoicePhrase(transcript, voiceProfile.primaryPhrase.phrase, {
        threshold: unlockMethods.voice.threshold,
      })
      setVoiceSimilarity(comparison.similarity)

      if (comparison.match) {
        setVoiceStatus('matched')
        setVoiceReason('Phrase matched. Unlocking...')
        unlockWithVoice()
        stopVoiceListener()
        unsubscribeStatus()
      } else {
        setVoiceStatus('failed')
        setVoiceReason('Phrase did not match. Try again.')
      }
    })

    await capture.start(unlockMethods.voice.selectedDeviceId)
  }

  const startClapListener = async () => {
    if (!clapEnabled || state !== 'locked' || lockedActive) {
      return
    }

    try {
      if (!audioAnalyzer.isReady()) {
        const stream = await microphoneCapture.getStream()
        if (!stream) throw new Error('Microphone stream unavailable')
        await audioAnalyzer.initialize(stream)
      }
    } catch (error) {
      setClapMessage('Microphone access is required for clap unlock.')
      setClapFeedback('disabled')
      return
    }

    setClapFeedback('ready')
    setClapMessage('Listening for your trained clap pattern...')
    setClapListening(true)

    if (engineRef.current) {
      engineRef.current.dispose()
      engineRef.current = null
    }

    const engine = new ClapDetectionEngine(audioAnalyzer)
    engineRef.current = engine
    engine.startListening()

    listenerTimeoutRef.current = window.setTimeout(async () => {
      const result = engineRef.current?.stopListening()
      if (!result) {
        setClapMessage('Unable to process clap input.')
        setClapFeedback('failed')
      } else if (result.detectedPattern?.clapCount && clapProfile?.primaryPattern) {
        setClapFeedback('validating')
        setClapMessage('Validating pattern...')
        const comparison = engine.compareWithProfile(result, clapProfile.primaryPattern)
        if (comparison.match) {
          setClapFeedback('matched')
          setClapMessage('Pattern recognized. Unlocking now.')
          useLockStore.getState().unlockWithClap()
          stopClapListener()
          return
        }
        setClapFeedback('failed')
        setClapMessage(`Clap detected, but pattern did not match (${Math.round(comparison.confidence)}%).`)
      } else {
        setClapFeedback('failed')
        setClapMessage('No valid clap pattern detected. Listening again...')
      }

      if (clapEnabled && state === 'locked' && !lockedActive) {
        retryTimeoutRef.current = window.setTimeout(() => {
          startClapListener()
        }, 1200)
      }
    }, 4200)
  }

  useEffect(() => {
    if (clapEnabled && state === 'locked' && !lockedActive) {
      startClapListener()
    } else {
      stopClapListener()
      if (!clapEnabled) {
        setClapMessage('Clap unlock is disabled or not trained.')
        setClapFeedback('disabled')
      } else if (state !== 'locked') {
        setClapMessage('Clap unlock will activate when the screen is locked.')
        setClapFeedback('disabled')
      }
    }

    return () => {
      stopClapListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clapEnabled, state, lockedActive, clapProfile?.primaryPattern?.clapCount])

  useEffect(() => {
    if (voiceEnabled && state === 'locked' && !lockedActive) {
      startVoiceListener()
    } else {
      stopVoiceListener()
      if (!voiceEnabled) {
        setVoiceStatus('disabled')
        setVoiceReason('Voice unlock is disabled or not trained.')
      } else if (state !== 'locked') {
        setVoiceStatus('disabled')
        setVoiceReason('Voice unlock will activate when the screen is locked.')
      }
    }

    return () => {
      stopVoiceListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled, state, lockedActive, voiceProfile?.primaryPhrase])

  const backupStatus = lockedActive
    ? `Locked for ${Math.max(0, Math.ceil((lockoutUntil! - now) / 1000))}s`
    : showBackupPin
    ? 'Enter your backup PIN to unlock.'
    : 'Backup PIN is available if modern unlock methods are not ready.'

  return (
    <motion.div
      className="mt-12 flex w-full max-w-3xl flex-col items-center gap-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <motion.div
        className="w-full rounded-[32px] border border-white/10 bg-black/20 p-6 glass-strong shadow-2xl shadow-cyan-500/10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent">Available Unlock Methods</div>
            <div className="text-2xl font-display mt-2">Use any active method to unlock Senti.</div>
          </div>

          <div className="grid gap-4">
            {futureMethods.map((method) => (
              <div key={method.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{method.label}</div>
                    <p className="text-sm text-secondary">{method.description}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-secondary">
                    {method.id === 'clap' ? (clapEnabled ? 'Ready' : method.status) : method.status}
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-white">Voice Unlock</div>
                  <p className="text-sm text-secondary">
                    {voiceEnabled
                      ? voiceStatus === 'listening'
                        ? 'Listening for your trained phrase...'
                        : voiceReason
                      : voiceProfile?.primaryPhrase
                      ? 'Voice unlock is trained but currently disabled in settings.'
                      : 'No voice phrase is configured yet. Train one in settings.'}
                  </p>
                </div>
                <div
                  className={`h-3.5 w-3.5 rounded-full ${
                    voiceStatus === 'matched'
                      ? 'bg-emerald-400'
                      : voiceStatus === 'listening'
                      ? 'bg-cyan-400'
                      : voiceStatus === 'failed'
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                  }`}
                />
              </div>
              {voiceEnabled && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/5 p-3 text-sm text-secondary">
                  <div>Transcript: {voiceTranscript || 'Waiting...'}</div>
                  <div>Confidence: {voiceConfidence.toFixed(2)}</div>
                  <div>Similarity: {voiceSimilarity.toFixed(2)}</div>
                  <div>Microphone: {unlockMethods.voice.selectedDeviceId || 'Default'}</div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-white">Clap Unlock</div>
                  <p className="text-sm text-secondary">
                    {clapEnabled
                      ? clapListening
                        ? 'Listening for your trained clap pattern...'
                        : clapMessage
                      : clapProfile?.primaryPattern
                      ? 'Clap unlock is trained but currently disabled in settings.'
                      : 'No clap pattern is configured yet. Train one in settings.'}
                  </p>
                </div>
                <div
                  className={`h-3.5 w-3.5 rounded-full ${
                    clapFeedback === 'matched'
                      ? 'bg-emerald-400'
                      : clapFeedback === 'validating'
                      ? 'bg-amber-400'
                      : clapFeedback === 'ready'
                      ? 'bg-cyan-400'
                      : 'bg-slate-500'
                  }`}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-5 ring-1 ring-white/5 shadow-lg shadow-cyan-700/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-white">Backup Access</div>
                  <p className="text-sm text-secondary">A secure fallback for premium experiences that still need a PIN.</p>
                </div>
                <button
                  onClick={handleShowBackup}
                  disabled={showBackupPin || lockedActive}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    showBackupPin || lockedActive
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-accent text-black hover:bg-accent-glow'
                  }`}
                >
                  {showBackupPin ? 'Backup PIN Active' : 'Use Backup PIN'}
                </button>
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.3em] text-secondary">
                {backupStatus}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showBackupPin && (
          <motion.div
            key="backup-panel"
            className="w-full rounded-[32px] border border-white/10 bg-black/20 p-6 glass-strong shadow-2xl shadow-cyan-500/10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="flex flex-col items-center gap-6">
              <div className="w-full max-w-md text-center">
                <div className="text-xs uppercase tracking-[0.3em] text-accent">Backup PIN</div>
                <div className="mt-2 text-sm text-secondary">Enter the 4-digit PIN you configured during setup.</div>
              </div>

              <motion.div
                className="relative w-full max-w-md"
                animate={shake ? { x: [-8, 8, -8, 8, 0] } : isUnlocking ? { scale: [1, 0.995, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                <input
                  ref={inputRef}
                  type="password"
                  value={pin}
                  onChange={handlePinChange}
                  onKeyDown={handleKeyDown}
                  maxLength={4}
                  className={`w-full rounded-3xl border px-6 py-5 text-center text-4xl text-white font-mono tracking-[1.4em] bg-black/40 outline-none transition-all duration-300 ${
                    isFailed
                      ? 'border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
                      : 'border-accent-muted focus:border-accent focus:ring-2 focus:ring-accent/20'
                  }`}
                  placeholder="••••"
                  aria-label="Enter backup PIN"
                  disabled={isUnlocking || lockedActive}
                />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-between px-10 -translate-y-1/2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="h-4 w-4 rounded-full"
                      initial={{ scale: 0.9, opacity: 0.6 }}
                      animate={
                        i < pin.length
                          ? { scale: [0.9, 1.18, 1], opacity: 1 }
                          : { scale: 1, opacity: 0.25 }
                      }
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      style={{
                        background: isFailed
                          ? i < pin.length
                            ? 'rgb(255,96,96)'
                            : 'rgba(255,96,96,0.18)'
                          : i < pin.length
                          ? 'rgb(0,212,255)'
                          : 'rgba(0,212,255,0.18)',
                        boxShadow:
                          i < pin.length && !isFailed
                            ? '0 0 14px rgba(0,212,255,0.85)'
                            : i < pin.length && isFailed
                            ? '0 0 14px rgba(255,96,96,0.9)'
                            : 'none',
                      }}
                    />
                  ))}
                </div>
              </motion.div>

              <motion.button
                onClick={handleSubmit}
                disabled={pin.length !== 4 || isUnlocking || lockedActive}
                className={`w-full max-w-md rounded-3xl px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] transition ${
                  pin.length === 4 && !isUnlocking && !lockedActive
                    ? 'bg-accent text-black hover:bg-accent-glow shadow-lg shadow-accent/20'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
                whileHover={pin.length === 4 && !lockedActive ? { scale: 1.02 } : {}}
                whileTap={pin.length === 4 && !lockedActive ? { scale: 0.98 } : {}}
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock with Backup PIN'}
              </motion.button>

              <div className="text-xs uppercase tracking-[0.3em] text-secondary">
                {isFailed ? `${failedAttempts} failed attempt${failedAttempts === 1 ? '' : 's'}` : 'Your backup PIN is stored locally and used only when needed.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
