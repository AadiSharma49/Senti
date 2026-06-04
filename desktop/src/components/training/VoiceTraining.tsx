import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '../../state/settingsStore'
import { useVoiceUnlockStore } from '../../state/voiceUnlockStore'
import { VoicePhrase } from '../../types/unlockProfiles'
import { compareVoicePhrase, VoiceComparisonResult } from '../../services/voiceValidationService'
import { LiveVoiceCapture, LiveVoiceCaptureStatus } from '../../services/liveVoiceCapture'
import VoiceDevelopmentPanel from './VoiceDevelopmentPanel'

type TrainingStep = 'select-phrase' | 'ready' | 'recording' | 'review' | 'complete'

interface VoiceTrainingAttempt {
  transcript: string
  confidence: number
  language: string
  matched: boolean
  comparison: VoiceComparisonResult | null
  timestamp: number
}

const suggestedPhrases = [
  'Senti unlock',
  'Open Senti',
  'Good evening Senti',
  'Hello Senti',
  'Wake up Senti',
  'Activate Senti',
]

const getQualityLabel = (confidence: number) => {
  if (confidence >= 90) return 'excellent'
  if (confidence >= 75) return 'good'
  if (confidence >= 55) return 'fair'
  return 'poor'
}

const DEFAULT_VOICE_UNLOCK_SETTINGS = {
  enabled: false,
  configured: false,
  threshold: 90,
  selectedDeviceId: '',
}

const getVoiceBridgeDiagnostics = () => {
  const api = (window as any).senti
  if (!api) {
    return {
      available: false,
      reason: 'window.senti is not defined',
      voiceAvailable: false,
    }
  }

  const hasHealth = typeof api.healthCheck === 'function'
  const hasBackendStatus = typeof api.onBackendStatus === 'function'
  const hasVoiceObject = api.voice && typeof api.voice.start === 'function' && typeof api.voice.stop === 'function' && typeof api.voice.transcribe === 'function'
  const hasTopLevelVoice = typeof api.voiceStart === 'function' && typeof api.voiceStop === 'function' && typeof api.voiceTranscribe === 'function'

  if (!hasHealth || !hasBackendStatus) {
    return {
      available: false,
      reason: 'Missing backend IPC methods: healthCheck or onBackendStatus',
      voiceAvailable: Boolean(hasVoiceObject || hasTopLevelVoice),
    }
  }

  if (!hasVoiceObject && !hasTopLevelVoice) {
    return {
      available: false,
      reason: 'Missing voice IPC methods: voice.start/stop/transcribe or voiceStart/voiceStop/voiceTranscribe',
      voiceAvailable: false,
    }
  }

  return {
    available: true,
    reason: 'IPC bridge available',
    voiceAvailable: true,
    voiceObject: hasVoiceObject,
    voiceTopLevel: hasTopLevelVoice,
  }
}

export default function VoiceTraining() {
  const settings = useSettingsStore((s) => s)
  const voiceSettings = settings.unlockMethods?.voice ?? DEFAULT_VOICE_UNLOCK_SETTINGS
  const voiceThreshold = Number.isFinite(voiceSettings.threshold) ? voiceSettings.threshold : 90
  const configuredDeviceId = String(voiceSettings.selectedDeviceId || '')
  const { profile, recordPhrase, confirmPhrase, completeTraining, startTraining } = useVoiceUnlockStore()
  const voiceCapture = useMemo(() => new LiveVoiceCapture(), [])

  const [step, setStep] = useState<TrainingStep>('select-phrase')
  const [selectedPhrase, setSelectedPhrase] = useState('')
  const [customPhrase, setCustomPhrase] = useState('')
  const [transcript, setTranscript] = useState('')
  const [comparison, setComparison] = useState<VoiceComparisonResult | null>(null)
  const [wakePhraseMode, setWakePhraseMode] = useState(true)
  const [micStatus, setMicStatus] = useState<LiveVoiceCaptureStatus>('idle')
  const [permissionStatus, setPermissionStatus] = useState('Idle')
  const [selectedDevice, setSelectedDevice] = useState('Default microphone')
  const [selectedDeviceId, setSelectedDeviceId] = useState(configuredDeviceId)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [listening, setListening] = useState(false)
  const [confidence, setConfidence] = useState(0)
  const [language, setLanguage] = useState('en')
  const [attempts, setAttempts] = useState<VoiceTrainingAttempt[]>([])
  const [attemptCount, setAttemptCount] = useState(0)
  const [backendConnected, setBackendConnected] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [ipcAvailable, setIpcAvailable] = useState(false)
  const [ipcReason, setIpcReason] = useState('Checking IPC...')
  const [voiceServiceStatus, setVoiceServiceStatus] = useState('Checking voice IPC...')
  const [backendStatus, setBackendStatus] = useState('Unknown')
  const [preloadLoaded, setPreloadLoaded] = useState(false)
  const [lastChunkId, setLastChunkId] = useState<number | null>(null)
  const [lastBackendMessage, setLastBackendMessage] = useState('Waiting for backend...')
  const [events, setEvents] = useState<string[]>([])
  const selectedPhraseRef = useRef('')
  const storedPhraseRef = useRef<string | null>(null)
  const wakePhraseModeRef = useRef(true)

  const pushEvent = (msg: string) => {
    setEvents((s) => [...s.slice(-200), `${new Date().toLocaleTimeString()} ${msg}`])
  }

  const refreshAudioDevices = async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAvailableDevices(devices.filter((device) => device.kind === 'audioinput'))
    } catch {
      // ignore device enumeration failures
    }
  }

  useEffect(() => {
    console.log('[VoiceTraining] mounted')
  }, [])

  useEffect(() => {
    const settingsLoaded = Boolean(settings.unlockMethods?.voice)
    const profileLoaded = Boolean(profile?.primaryPhrase)
    const diagnostics = getVoiceBridgeDiagnostics()

    console.log(settingsLoaded ? '[VoiceTraining] Voice settings loaded' : '[VoiceTraining] Voice settings missing')
    console.log(profileLoaded ? '[VoiceTraining] Voice profile loaded' : '[VoiceTraining] Voice profile missing')
    console.log(diagnostics.available ? '[VoiceTraining] IPC available' : `[VoiceTraining] IPC unavailable: ${diagnostics.reason}`)
    console.log('[VoiceTraining] window.senti type:', typeof (window as any).senti, 'voice methods:', diagnostics.voiceAvailable)
    setPreloadLoaded(typeof (window as any).senti !== 'undefined')
    setIpcAvailable(diagnostics.available)
    setIpcReason(diagnostics.reason)
    setVoiceServiceStatus(diagnostics.voiceAvailable ? 'Voice IPC methods present' : 'Voice IPC methods missing')
    setBackendStatus(diagnostics.available ? 'IPC bridge ready' : 'IPC bridge unavailable')
  }, [settings.unlockMethods, profile])

  useEffect(() => {
    refreshAudioDevices()
  }, [])

  useEffect(() => {
    startTraining()
    return () => {
      voiceCapture.stop()
    }
  }, [voiceCapture, startTraining])

  useEffect(() => {
    voiceCapture.setCallbacks({
      onStatusChange: (status) => {
        setMicStatus(status)
        if (status === 'active') {
          setPermissionStatus('Granted')
          setListening(true)
        } else if (status === 'requesting') {
          setPermissionStatus('Requesting permission')
        } else if (status === 'stopped') {
          setPermissionStatus('Stopped')
          setListening(false)
        } else if (status === 'error') {
          setPermissionStatus('Microphone error')
          setListening(false)
        } else {
          setPermissionStatus('Idle')
          setListening(false)
        }
      },
      onDeviceChange: setSelectedDevice,
      onError: (message) => {
        setPermissionStatus(message)
        pushEvent(`error: ${message}`)
      },
      onChunkSent: (chunkId) => {
        setLastChunkId(chunkId)
        pushEvent(`chunk ${chunkId} sent to backend`)
      },
    })
  }, [voiceCapture])

  useEffect(() => {
    selectedPhraseRef.current = selectedPhrase
    storedPhraseRef.current = profile.primaryPhrase?.phrase || null
    wakePhraseModeRef.current = wakePhraseMode
  }, [profile.primaryPhrase, selectedPhrase, wakePhraseMode])

  useEffect(() => {
    const diagnostics = getVoiceBridgeDiagnostics()
    if (!diagnostics.available) {
      setBackendConnected(false)
      setModelLoaded(false)
      setLastBackendMessage('Electron voice bridge unavailable. Launch with npm run electron:dev.')
      pushEvent(`voice bridge unavailable: ${diagnostics.reason}`)
      return
    }

    const api = (window as any).senti
    try {
      if (typeof api.healthCheck === 'function') {
        api.healthCheck()
          .then((health: any) => {
            if (typeof health === 'object') {
              setBackendConnected(Boolean(health.backendConnected))
              setModelLoaded(Boolean(health.modelLoaded))
              setBackendStatus(health.backendConnected ? 'Backend connected' : 'Backend disconnected')
            }
          })
          .catch((err: any) => {
            console.warn('[VoiceTraining] healthCheck failed', err)
            setBackendStatus('Backend health check failed')
          })
      }
    } catch (err) {
      console.warn('[VoiceTraining] healthCheck threw', err)
      setBackendStatus('Backend health check threw exception')
    }

    const cleanup = typeof api.onBackendStatus === 'function'
      ? api.onBackendStatus((data: any) => {
          if (typeof data?.backendConnected === 'boolean') {
            setBackendConnected(data.backendConnected)
            setBackendStatus(data.backendConnected ? 'Backend connected' : 'Backend disconnected')
          }
          if (typeof data?.modelLoaded === 'boolean') setModelLoaded(data.modelLoaded)
          if (typeof data?.message === 'string') setLastBackendMessage(data.message)

          if (data?.event !== 'voice:transcript') return

          const detected = String(data.transcript || '').trim()
          const detectedConfidence = Number(data.confidence || 0)
          setTranscript(detected)
          setConfidence(detectedConfidence)
          setLanguage(String(data.language || 'en'))
          setLastChunkId(typeof data.chunkId === 'number' ? data.chunkId : null)
          pushEvent(`transcript: "${detected || '[no speech]'}" (${detectedConfidence}%)`)

          const stored = storedPhraseRef.current || selectedPhraseRef.current
          if (wakePhraseModeRef.current && stored && detected) {
            setComparison(compareVoicePhrase(detected, stored, { threshold: voiceThreshold }))
          } else if (!detected) {
            setComparison(null)
          }
        })
      : undefined

    return () => {
      cleanup?.()
    }
  }, [voiceThreshold])

  const handleSelectPhrase = (phrase: string) => {
    setSelectedPhrase(phrase)
    setStep('ready')
  }

  const handleCustomPhrase = () => {
    if (customPhrase.trim().length >= 3) {
      setSelectedPhrase(customPhrase.trim())
      setStep('ready')
    }
  }

  const startRecording = async () => {
    console.log('[VoiceTraining] Button Clicked: Start Live Detection')
    pushEvent('Button Clicked: Start Live Detection')
    
    if (!selectedPhrase) {
      console.warn('[VoiceTraining] No phrase selected')
      return
    }
    
    const diagnostics = getVoiceBridgeDiagnostics()
    if (!diagnostics.available) {
      console.error('[VoiceTraining] Voice IPC unavailable:', diagnostics.reason)
      setPermissionStatus(`Voice IPC unavailable: ${diagnostics.reason}`)
      setLastBackendMessage('Launch Senti through Electron, not the plain Vite browser.')
      pushEvent(`cannot start: ${diagnostics.reason}`)
      return
    }

    setTranscript('')
    setConfidence(0)
    setLanguage('en')
    setComparison(null)
    setLastChunkId(null)

    console.log('[VoiceTraining] Calling LiveVoiceCapture.start() with deviceId:', selectedDeviceId || 'default')
    pushEvent('LiveVoiceCapture.start() called')
    
    const active = await voiceCapture.start(selectedDeviceId || undefined)
    console.log('[VoiceTraining] LiveVoiceCapture.start() returned:', active)
    
    if (!active) {
      console.error('[VoiceTraining] Failed to start voice capture')
      setPermissionStatus('Unable to start live voice capture')
      pushEvent('FAILED: Unable to start live voice capture')
      return
    }

    console.log('[VoiceTraining] Live detection started successfully')
    pushEvent('Live detection started successfully')
    setStep('recording')
    setAttemptCount((count) => count + 1)
  }

  const stopRecording = () => {
    voiceCapture.stop()
    setListening(false)

    if (!transcript.trim()) {
      setPermissionStatus('No speech detected yet. Wait for a transcript or try again.')
      return
    }

    const phraseEntry: VoicePhrase = {
      phrase: selectedPhrase,
      recordedAt: Date.now(),
      duration: 0,
      metadata: {
        confidence,
        quality: getQualityLabel(confidence),
      },
    }

    recordPhrase(phraseEntry)
    setAttempts((prev) => [
      ...prev,
      {
        transcript,
        confidence,
        language,
        matched: comparison?.match ?? false,
        comparison,
        timestamp: Date.now(),
      },
    ])

    if (attemptCount >= 3) {
      setStep('review')
    } else {
      setStep('ready')
    }
  }

  const pingBackend = async () => {
    const api = (window as any).senti
    if (!api || typeof api.healthCheck !== 'function') {
      setLastBackendMessage('Backend ping failed: healthCheck unavailable')
      setBackendStatus('Backend ping failed')
      pushEvent('backend ping failed: healthCheck unavailable')
      return
    }

    try {
      const health = await api.healthCheck()
      setBackendConnected(Boolean(health?.backendConnected))
      setModelLoaded(Boolean(health?.modelLoaded))
      setBackendStatus(health?.backendConnected ? 'Backend Alive' : 'Backend Offline')
      setLastBackendMessage(`Ping result: backendConnected=${Boolean(health?.backendConnected)}, modelLoaded=${Boolean(health?.modelLoaded)}`)
      pushEvent('backend ping succeeded')
    } catch (err: any) {
      setLastBackendMessage(`Backend ping error: ${err?.message || 'unknown'}`)
      setBackendStatus('Backend ping error')
      pushEvent(`backend ping error: ${err?.message || 'unknown'}`)
    }
  }

  const handleConfirmPhrase = (phraseIndex: number) => {
    confirmPhrase(phraseIndex)
    setStep('complete')
  }

  const handleCompleteTraining = () => {
    completeTraining()
    setStep('select-phrase')
  }

  const beginNewPhrase = () => {
    setSelectedPhrase('')
    setCustomPhrase('')
    setTranscript('')
    setConfidence(0)
    setComparison(null)
    setStep('select-phrase')
  }

  const currentStoredPhrase = profile.primaryPhrase?.phrase || 'Not configured'

  return (
    <motion.div
      className="w-full space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-secondary">IPC Status</div>
            <div className="mt-2 text-white">{ipcAvailable ? 'Available' : 'Unavailable'}</div>
            <div className="text-xs text-amber-300 mt-1">{ipcReason}</div>
            <div className="text-xs text-secondary mt-2">Preload Loaded: {preloadLoaded ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-secondary">Backend Status</div>
            <div className="mt-2 text-white">{backendStatus}</div>
            <div className="text-xs text-amber-300 mt-1">{lastBackendMessage}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-secondary">Voice Service Status</div>
            <div className="mt-2 text-white">{voiceServiceStatus}</div>
            <button onClick={pingBackend} className="mt-3 rounded-2xl bg-accent px-3 py-2 text-xs font-semibold text-black hover:bg-accent-glow transition">
              Ping Backend
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'select-phrase' && (
          <motion.div key="select-phrase" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="font-semibold text-white mb-2">Choose Your Voice Unlock Phrase</h4>
              <p className="text-xs text-secondary mb-4">Select a wake phrase you can say naturally, or type your own.</p>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.3em] text-accent">Suggested Phrases</div>
              {suggestedPhrases.map((phrase) => (
                <button key={phrase} onClick={() => handleSelectPhrase(phrase)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:border-accent hover:bg-accent/10 transition text-left">
                  {phrase}
                </button>
              ))}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                <div className="text-xs uppercase tracking-[0.3em] text-secondary">Or</div>
              </div>
              <div className="border-t border-white/10" />
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={customPhrase}
                onChange={(e) => setCustomPhrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customPhrase.trim().length >= 3) handleCustomPhrase()
                }}
                placeholder="Create your own phrase"
                className="input-glass"
              />
              <button onClick={handleCustomPhrase} disabled={customPhrase.trim().length < 3} className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-glow transition">
                Use Custom Phrase
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-secondary">Stored Phrase</div>
              <div className="mt-2 text-sm text-white">{currentStoredPhrase}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-secondary">Microphone Selection</div>
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value)
                  settings.setUnlockMethod('voice', {
                    ...voiceSettings,
                    selectedDeviceId: e.target.value,
                  })
                }}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"
              >
                <option value="">Default microphone</option>
                {availableDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId}`}
                  </option>
                ))}
              </select>
              <div className="text-xs text-secondary mt-3">Choose the microphone used for voice training and unlock.</div>
            </div>
          </motion.div>
        )}

        {step === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="font-semibold text-white mb-2">Live Faster-Whisper Detection</h4>
              <p className="text-sm text-secondary mb-4">Senti will stream microphone chunks through Electron IPC to the Python Faster-Whisper backend.</p>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white space-y-3">
                <div>
                  <div className="font-semibold">Selected Phrase</div>
                  <div className="mt-2">{selectedPhrase}</div>
                </div>
                <div>
                  <div className="font-semibold">Training Progress</div>
                  <div className="mt-2">Attempt {attemptCount + 1} of 3</div>
                </div>
                <div>
                  <div className="font-semibold">Selected Microphone</div>
                  <div className="mt-2">{selectedDevice}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={startRecording} className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition">
                Start Live Detection
              </button>
              <button onClick={() => setStep('select-phrase')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
                Change Phrase
              </button>
            </div>
          </motion.div>
        )}

        {step === 'recording' && (
          <motion.div key="recording" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="space-y-4">
            <div className="rounded-2xl border border-accent/50 bg-accent/10 p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-accent">Listening...</div>
                  <div className="mt-2 text-white">Say your selected phrase now.</div>
                </div>
                <div className="rounded-full bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                  {listening ? 'Microphone Active' : 'Starting'}
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <div className="text-sm text-secondary mb-2">Transcript</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 min-h-[96px] text-white whitespace-pre-wrap">
                    {transcript ? `"${transcript}"` : 'Waiting for speech...'}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-secondary">Confidence</div>
                    <div className="mt-2 text-2xl text-white">{confidence ? `${confidence}%` : '-'}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-secondary">Language</div>
                    <div className="mt-2 text-2xl text-white">{language}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-secondary">Match</div>
                    <div className="mt-2 text-2xl text-white">{comparison ? (comparison.match ? 'TRUE' : 'FALSE') : 'PENDING'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button onClick={stopRecording} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
                  Stop and Review
                </button>
                <button onClick={() => setWakePhraseMode((value) => !value)} className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
                  {wakePhraseMode ? 'Disable Phrase Match' : 'Enable Phrase Match'}
                </button>
              </div>
            </div>

            <VoiceDevelopmentPanel
              micStatus={micStatus}
              deviceLabel={selectedDevice}
              permissionStatus={permissionStatus}
              transcript={transcript}
              confidence={confidence}
              language={language}
              comparison={comparison}
              wakePhraseMode={wakePhraseMode}
              listening={listening}
              events={events}
              backendConnected={backendConnected}
              modelLoaded={modelLoaded}
              lastChunkId={lastChunkId}
              lastBackendMessage={lastBackendMessage}
            />
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="font-semibold text-white mb-2">Review and Save Your Training Phrase</h4>
              <p className="text-sm text-secondary mb-4">Select the captured attempt that should become your stored phrase.</p>
              <div className="space-y-3">
                {attempts.length > 0 ? (
                  profile.phrases.map((phrase, idx) => {
                    const attempt = attempts[idx]
                    return (
                      <button key={phrase.recordedAt} onClick={() => handleConfirmPhrase(idx)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-accent hover:bg-accent/10 transition">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-white">{phrase.phrase}</div>
                          <div className="text-xs text-secondary">Select attempt</div>
                        </div>
                        <div className="text-xs text-secondary">Transcript: {attempt?.transcript || '―'}</div>
                        <div className="text-xs text-secondary">Confidence: {attempt?.confidence ?? 0}%</div>
                        <div className="text-xs text-secondary">Quality: {attempt?.comparison?.reason || phrase.metadata.quality}</div>
                      </button>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-secondary">No captured attempts were available. You can go back and record again.</div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={startRecording} className="flex-1 rounded-2xl border border-accent px-4 py-3 text-sm font-semibold text-accent hover:bg-accent/10 transition">
                Record Another Attempt
              </button>
              {profile.phrases.length > 0 && (
                <button onClick={() => setStep('complete')} className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition">
                  Skip to Saved Phrase
                </button>
              )}
            </div>
          </motion.div>
        )}

        {step === 'complete' && (
          <motion.div key="complete" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="space-y-4">
            <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 text-center">
              <motion.div className="text-4xl mb-3" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }}>
                ✓
              </motion.div>
              <h4 className="font-semibold text-white mb-2">Voice Training Ready</h4>
              <p className="text-sm text-secondary">Your preferred wake phrase has been stored for live Faster-Whisper detection tests.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-secondary">Stored Phrase</div>
              <div className="mt-2 text-lg text-white">{profile.primaryPhrase?.phrase || selectedPhrase}</div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={beginNewPhrase} className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
                Edit Phrase
              </button>
              <button onClick={handleCompleteTraining} className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition">
                Finish Training
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
