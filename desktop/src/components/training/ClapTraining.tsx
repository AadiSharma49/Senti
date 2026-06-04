import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClapUnlockStore } from '../../state/clapUnlockStore'
import { microphoneCapture, MicrophoneStatus } from '../../services/microphoneCapture'
import { audioAnalyzer, AudioAnalysisFrame } from '../../services/audioAnalyzer'
import { ClapPattern } from '../../types/unlockProfiles'

type TrainingStep = 'explain' | 'recording' | 'review' | 'complete'

export default function ClapTraining() {
  const { profile, recordPattern, confirmPattern, completeTraining, startTraining } = useClapUnlockStore()
  const [step, setStep] = useState<TrainingStep>('explain')
  const [clapCount, setClapCount] = useState(0)
  const [recordingAttempt, setRecordingAttempt] = useState(0)
  const [clapTimings, setClapTimings] = useState<number[]>([])
  const [lastClapTime, setLastClapTime] = useState<number | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [micStatus, setMicStatus] = useState<MicrophoneStatus>('idle')
  const [deviceLabel, setDeviceLabel] = useState('No device selected')
  const clapCountRef = useRef(0)
  const [currentLevel, setCurrentLevel] = useState(0)
  const [peakLevel, setPeakLevel] = useState(0)
  const [detectionThreshold, setDetectionThreshold] = useState(0.01)
  const [lastDetectedAmplitude, setLastDetectedAmplitude] = useState(0)
  const [lastCandidateReason, setLastCandidateReason] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioMonitorIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const detectionFrameBufferRef = useRef<AudioAnalysisFrame[]>([])
  const lastDetectedClapTimestampRef = useRef<number>(0)

  useEffect(() => {
    startTraining()
    return () => {
      if (audioMonitorIntervalRef.current) {
        clearInterval(audioMonitorIntervalRef.current)
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
      }
      audioAnalyzer.dispose()
      microphoneCapture.stop()
    }
  }, [startTraining])

  const appendLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 10))
    console.log('[ClapTraining]', message)
  }

  const stopAudioMonitoring = () => {
    if (audioMonitorIntervalRef.current) {
      clearInterval(audioMonitorIntervalRef.current)
      audioMonitorIntervalRef.current = null
    }
    audioAnalyzer.dispose()
    microphoneCapture.stop()
    setMicStatus('idle')
  }

  const beginAudioMonitoring = () => {
    detectionFrameBufferRef.current = []
    lastDetectedClapTimestampRef.current = 0
    setLastCandidateReason(null)
    setLastDetectedAmplitude(0)

    if (audioMonitorIntervalRef.current) {
      clearInterval(audioMonitorIntervalRef.current)
    }

    audioMonitorIntervalRef.current = setInterval(() => {
      const frame = audioAnalyzer.getAnalysisFrame()
      if (!frame) {
        return
      }

      setCurrentLevel(frame.rmsAmplitude)
      setPeakLevel(frame.peakAmplitude)
      setLastDetectedAmplitude(frame.peakAmplitude)
      detectionFrameBufferRef.current.push(frame)
      if (detectionFrameBufferRef.current.length > 25) {
        detectionFrameBufferRef.current.shift()
      }

      const threshold = detectionThreshold
      const candidateReason = audioAnalyzer.getClapCandidateReason(frame, threshold)
      if (candidateReason) {
        setLastCandidateReason(candidateReason)
        appendLog(
          `Rejected clap candidate — Amplitude: ${frame.peakAmplitude.toFixed(3)}, Threshold: ${threshold.toFixed(3)}, Reason: ${candidateReason}`
        )
      }

      const peaks = audioAnalyzer.detectPeaks(detectionFrameBufferRef.current, 0.85, threshold)
      if (peaks.length > 0) {
        const latestPeak = peaks[peaks.length - 1]
        if (latestPeak.timestamp - lastDetectedClapTimestampRef.current > audioAnalyzer.MIN_CLAP_INTERVAL) {
          lastDetectedClapTimestampRef.current = latestPeak.timestamp
          const now = Date.now()
          clapCountRef.current += 1
          setClapCount(clapCountRef.current)
          if (lastClapTime !== null) {
            const interval = now - lastClapTime
            setClapTimings((prev) => [...prev, interval])
          }
          setLastClapTime(now)
          setLastCandidateReason('Clap detected')
          appendLog(`Clap detected — Amplitude: ${latestPeak.volume.toFixed(3)}, Timestamp: ${now}`)
        }
      }
    }, 50)
  }

  const requestMicrophone = async (): Promise<boolean> => {
    setErrorMessage(null)
    setMicStatus('requesting')
    appendLog('Requesting microphone permission')

    const stream = await microphoneCapture.getStream()
    if (!stream) {
      const status = microphoneCapture.status
      setMicStatus(status)
      const message = status === 'permission-denied'
        ? 'Microphone permission denied. Please allow access.'
        : 'Microphone unavailable. Check your device.'
      setErrorMessage(message)
      appendLog(message)
      return false
    }

    setMicStatus('active')
    const deviceName = stream.getAudioTracks()[0]?.label || 'Unknown device'
    setDeviceLabel(deviceName)
    appendLog('Microphone permission granted')

    const success = await audioAnalyzer.initialize(stream)
    if (!success) {
      setMicStatus('error')
      setErrorMessage('Audio analyzer failed to initialize.')
      appendLog('Audio analyzer failed to initialize')
      return false
    }

    appendLog('Microphone initialized')
    appendLog('Audio analyzer active')
    beginAudioMonitoring()

    return true
  }

  const handleClapDetection = () => {
    if (!isRecording) return

    const now = Date.now()
    if (lastClapTime !== null) {
      const interval = now - lastClapTime
      setClapTimings((prev) => [...prev, interval])
    }

    setLastClapTime(now)
    clapCountRef.current += 1
    setClapCount(clapCountRef.current)

    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
    }
    recordingTimeoutRef.current = setTimeout(() => {
      finishRecording()
    }, 5000)
  }

  const startRecording = async (): Promise<boolean> => {
    clapCountRef.current = 0
    setClapCount(0)
    setClapTimings([])
    setLastClapTime(null)
    setIsRecording(true)
    setRecordingAttempt((prev) => prev + 1)
    setLogs([])
    setErrorMessage(null)
    setDeviceLabel('No device selected')
    setCurrentLevel(0)
    setPeakLevel(0)

    const microphoneReady = await requestMicrophone()
    if (!microphoneReady) {
      setIsRecording(false)
      return false
    }

    recordingTimeoutRef.current = setTimeout(() => {
      finishRecording()
    }, 30000)

    return true
  }

  const finishRecording = () => {
    setIsRecording(false)
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
    }
    stopAudioMonitoring()

    const finalClapCount = clapCountRef.current
    appendLog(`Finishing recording. Final clap count: ${finalClapCount}`)

    if (finalClapCount >= 2) {
      const pattern: ClapPattern = {
        clapCount: finalClapCount,
        timingIntervals: clapTimings,
        capturedAt: Date.now(),
      }
      recordPattern(pattern)
      setStep('review')
      return
    }

    const message = 'No valid clap pattern detected. Try a louder, clearer set of two quick claps near your headset microphone.'
    setErrorMessage(message)
    appendLog(message)
  }

  const handleConfirmPattern = (patternIndex: number) => {
    confirmPattern(patternIndex)
  }

  const handleCompleteTraining = () => {
    completeTraining()
    setStep('explain') // Reset for potential retrain
  }

  return (
    <motion.div
      className="w-full max-h-[85vh] overflow-hidden rounded-3xl bg-slate-950/95 shadow-2xl sm:max-w-4xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <AnimatePresence mode="wait">
        {step === 'explain' && (
          <motion.div
            key="explain"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <div className="min-h-0 overflow-y-auto px-4 pb-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="font-semibold text-white mb-2">Train Your Clap Pattern</h4>
              <p className="text-sm text-secondary mb-4">
                We'll record your unique clap pattern to unlock Senti. This is a custom sequence that only you know.
              </p>
              <ul className="text-xs text-secondary space-y-2 mb-4">
                <li>✓ Perform 2-5 claps in your unique rhythm</li>
                <li>✓ We'll record the timing between each clap</li>
                <li>✓ You can train up to 3 times</li>
                <li>✓ Choose your best attempt</li>
              </ul>
              <p className="text-xs text-accent font-semibold">Examples: 👏 👏 👏 or 👏 👏 👏 👏</p>
            </div>

            <button
              onClick={async () => {
                const started = await startRecording()
                if (started) {
                  setStep('recording')
                }
              }}
              className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition"
            >
              Start First Attempt
            </button>
            </div>
          </motion.div>
        )}

        {step === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <div className="min-h-0 overflow-y-auto px-4 pb-4">
              <div className="rounded-2xl border border-accent/50 bg-accent/10 p-6 text-center">
              <div className="text-xs uppercase tracking-[0.3em] text-accent mb-4">Recording in progress</div>
              <motion.div
                className="text-6xl font-bold text-accent mb-6"
                animate={{ scale: clapCount > 0 ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                👏 × {clapCount}
              </motion.div>
              <p className="text-sm text-secondary mb-4">Perform your clap pattern now. The microphone is listening live.</p>

              <div className="space-y-4 mb-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-[0.3em] text-secondary">Microphone</span>
                    <span className="text-xs text-accent">{micStatus.toUpperCase()}</span>
                  </div>
                  <div className="mb-2 text-sm">Device: {deviceLabel}</div>
                  <div className="text-xs text-secondary">Current level: {currentLevel.toFixed(3)}</div>
                  <div className="text-xs text-secondary">Peak level: {peakLevel.toFixed(3)}</div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10 relative">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all"
                      style={{ width: `${Math.min(100, peakLevel * 140)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 top-0 w-px bg-white/70"
                      style={{ left: `${Math.min(100, detectionThreshold * 140)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.3em] text-secondary">
                    <span>Threshold: {detectionThreshold.toFixed(3)}</span>
                    <span>Detected amplitude: {lastDetectedAmplitude.toFixed(3)}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-white">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-[0.3em] text-secondary">Threshold Debug</span>
                    <span className="text-xs text-accent">{detectionThreshold.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.003}
                    max={0.02}
                    step={0.001}
                    value={detectionThreshold}
                    onChange={(e) => setDetectionThreshold(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="mt-2 text-xs text-secondary">
                    Slide threshold lower for quiet headset claps, higher for noisy environments.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-[0.3em] text-secondary">Diagnostics</span>
                    <span className="text-xs text-accent">{lastCandidateReason || 'Listening for clap...'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-secondary">
                    <div>Peak amplitude</div>
                    <div className="text-right">{peakLevel.toFixed(3)}</div>
                    <div>RMS level</div>
                    <div className="text-right">{currentLevel.toFixed(3)}</div>
                    <div>Clap count</div>
                    <div className="text-right">{clapCount}</div>
                    <div>Threshold</div>
                    <div className="text-right">{detectionThreshold.toFixed(3)}</div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {errorMessage}
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-white max-h-44 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
                  <div className="text-xs uppercase tracking-[0.3em] text-secondary mb-2">Event log</div>
                  {logs.length === 0 ? (
                    <div className="text-xs text-secondary">Waiting for microphone events...</div>
                  ) : (
                    <ul className="space-y-1 text-xs font-mono">
                      {logs.map((log, idx) => (
                        <li key={idx} className="break-words">{log}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleClapDetection}
                  className="flex-1 rounded-2xl bg-accent/20 px-4 py-4 text-2xl font-semibold hover:bg-accent/40 transition"
                  title="Simulate clap detection"
                >
                  👏 Clap
                </button>
                <button
                  onClick={finishRecording}
                  className="flex-1 rounded-2xl border border-accent/50 px-4 py-4 text-sm font-semibold text-accent hover:bg-accent/10 transition"
                >
                  Done
                </button>
                {!isRecording && clapCount < 2 && (
                  <button
                    onClick={async () => {
                      const started = await startRecording()
                      if (started) {
                        setStep('recording')
                      }
                    }}
                    className="flex-1 rounded-2xl border border-accent/50 px-4 py-4 text-sm font-semibold text-accent hover:bg-accent/10 transition"
                  >
                    Try Again
                  </button>
                )}
              </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="font-semibold text-white mb-2">Review Your Patterns</h4>
              <p className="text-sm text-secondary">Select the pattern you want to keep, then confirm to finish training.</p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4 sm:px-6">
              <div className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 scrollbar-thin scrollbar-thumb-white/20">
                <div className="space-y-4">
                  {profile.patterns.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-secondary">
                      No patterns are available yet. Record a clap pattern to review it here.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {profile.patterns.map((pattern, idx) => {
                        const isSelected = profile.primaryPattern?.capturedAt === pattern.capturedAt
                        return (
                          <div
                            key={idx}
                            className={`rounded-2xl border p-4 transition ${
                              isSelected
                                ? 'border-accent bg-accent/10'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="text-lg font-semibold">👏 × {pattern.clapCount}</div>
                                <div className="text-xs text-secondary mt-2">
                                  Timing intervals: {pattern.timingIntervals.map((t) => `${t}ms`).join(', ') || 'N/A'}
                                </div>
                              </div>
                              <button
                                onClick={() => handleConfirmPattern(idx)}
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                  isSelected
                                    ? 'bg-green-500/20 text-green-300 border border-green-400/40'
                                    : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'
                                }`}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 z-10 rounded-2xl border border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl shadow-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-secondary">Next step</div>
                    {!profile.primaryPattern ? (
                      <div className="text-sm text-red-200">Select a pattern to continue.</div>
                    ) : (
                      <div className="text-sm text-secondary">Pattern selected. Confirm to finish training.</div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {recordingAttempt < 3 && (
                      <button
                        onClick={async () => {
                          const started = await startRecording()
                          if (started) {
                            setStep('recording')
                          }
                        }}
                        className="flex-1 rounded-2xl border border-accent px-4 py-3 text-sm font-semibold text-accent hover:bg-accent/10 transition"
                      >
                        Record Another Attempt
                      </button>
                    )}
                    <button
                      disabled={!profile.primaryPattern}
                      onClick={() => setStep('complete')}
                      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        profile.primaryPattern
                          ? 'bg-accent text-black hover:bg-accent-glow'
                          : 'cursor-not-allowed bg-white/10 text-white/40'
                      }`}
                    >
                      Confirm & Finish
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 text-center">
              <motion.div className="text-4xl mb-3" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }}>
                ✓
              </motion.div>
              <h4 className="font-semibold text-white mb-2">Clap Pattern Trained</h4>
              <p className="text-sm text-secondary">
                Your unique clap pattern has been saved. You can now use it to unlock Senti when this feature is activated.
              </p>
            </div>

            <button
              onClick={handleCompleteTraining}
              className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
