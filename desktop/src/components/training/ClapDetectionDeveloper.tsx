import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClapUnlockStore } from '../../state/clapUnlockStore'
import { microphoneCapture, MicrophoneStatus } from '../../services/microphoneCapture'
import { audioAnalyzer, AudioAnalyzer, AudioAnalysisFrame } from '../../services/audioAnalyzer'
import { ClapDetectionEngine, DetectionResult, PatternComparisonResult } from '../../services/clapDetectionEngine'

type DetectionPhase = 'idle' | 'checking-mic' | 'listening' | 'complete' | 'error'

interface ClapDetectionFeedback {
  detectionResult: DetectionResult | null
  comparisonResult: PatternComparisonResult | null
}

/**
 * TEMPORARY DEVELOPER FEEDBACK COMPONENT
 * 
 * Shows real-time clap detection and pattern matching.
 * This is for testing/development only - will be removed in production.
 */
export default function ClapDetectionDeveloper() {
  const clapProfile = useClapUnlockStore((s) => s.profile)
  const [isOpen, setIsOpen] = useState(false)
  const [phase, setPhase] = useState<DetectionPhase>('idle')
  const [micStatus, setMicStatus] = useState<MicrophoneStatus>('idle')
  const [deviceLabel, setDeviceLabel] = useState<string>('')
  const [threshold, setThreshold] = useState<number>(0.18)
  const [meterFrame, setMeterFrame] = useState<AudioAnalysisFrame | null>(null)
  const [feedback, setFeedback] = useState<ClapDetectionFeedback>({ detectionResult: null, comparisonResult: null })

  const detectionEngineRef = useRef<ClapDetectionEngine | null>(null)
  const meterIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const micStatusUnsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (detectionEngineRef.current) {
        detectionEngineRef.current.dispose()
      }
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current)
      }
      if (micStatusUnsubscribeRef.current) {
        micStatusUnsubscribeRef.current()
      }
    }
  }, [])

  const handleStartDetection = async () => {
    if (!clapProfile.primaryPattern) {
      alert('No trained clap pattern found. Please train first.')
      return
    }

    setPhase('checking-mic')
    setFeedback({ detectionResult: null, comparisonResult: null })

    try {
      // Initialize microphone
      const stream = await microphoneCapture.getStream()
      if (!stream) {
        setPhase('error')
        return
      }

      // Initialize audio analyzer
      const success = await audioAnalyzer.initialize(stream)
      if (!success) {
        setPhase('error')
        return
      }

      // Create detection engine
      const engine = new ClapDetectionEngine(audioAnalyzer)
      engine.detectionThreshold = threshold
      detectionEngineRef.current = engine

      setDeviceLabel(stream.getAudioTracks()[0]?.label || 'Unknown device')
      setMicStatus('active')
      setPhase('listening')

      // Start listening
      engine.startListening()

      // Start meter updates
      meterIntervalRef.current = setInterval(() => {
        const liveFrame = audioAnalyzer.getAnalysisFrame()
        if (liveFrame) {
          setMeterFrame(liveFrame)
        }
      }, 50)

      // Auto-stop after 6 seconds
      setTimeout(() => {
        if (detectionEngineRef.current && detectionEngineRef.current.isListening_()) {
          const result = engine.stopListening()
          setFeedback((prev) => ({
            ...prev,
            detectionResult: result,
          }))

          const comparison = engine.compareWithProfile(result, clapProfile.primaryPattern!)
          setFeedback((prev) => ({
            ...prev,
            comparisonResult: comparison,
          }))

          setPhase('complete')
          engine.dispose()
          audioAnalyzer.dispose()
          microphoneCapture.stop()
          if (meterIntervalRef.current) {
            clearInterval(meterIntervalRef.current)
            meterIntervalRef.current = null
          }
        }
      }, 6000)
    } catch (error) {
      console.error('[ClapDetection] Error:', error)
      setPhase('error')
      if (detectionEngineRef.current) {
        detectionEngineRef.current.dispose()
      }
      microphoneCapture.stop()
    }
  }

  const handleStop = () => {
    if (detectionEngineRef.current) {
      const result = detectionEngineRef.current.stopListening()
      setFeedback((prev) => ({
        ...prev,
        detectionResult: result,
      }))

      if (clapProfile.primaryPattern) {
        const comparison = detectionEngineRef.current.compareWithProfile(result, clapProfile.primaryPattern)
        setFeedback((prev) => ({
          ...prev,
          comparisonResult: comparison,
        }))
      }

      setPhase('complete')
      detectionEngineRef.current.dispose()
      audioAnalyzer.dispose()
      microphoneCapture.stop()
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current)
        meterIntervalRef.current = null
      }
    }
  }

  const handleReset = () => {
    setPhase('idle')
    setFeedback({ detectionResult: null, comparisonResult: null })
    setMeterFrame(null)
    setDeviceLabel('')
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current)
      meterIntervalRef.current = null
    }
  }

  return (
    <>
      {/* Floating button to open developer panel */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full bg-purple-500/80 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-600 transition"
        title="Developer: Clap Detection Test (TEMPORARY)"
      >
        🎙️ Test Clap
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed right-4 top-4 z-50 w-96 max-h-96 overflow-y-auto rounded-2xl border border-purple-500/30 bg-black/90 p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs uppercase tracking-[0.3em] text-purple-400">Developer Tools</div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/60 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Status Display */}
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-secondary mb-2">Status</div>
                  <div className="text-sm font-mono text-accent">{phase.toUpperCase()}</div>
                </div>

                {/* Trained Profile Info */}
                {clapProfile.primaryPattern && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="text-xs text-secondary mb-2">Trained Pattern</div>
                    <div className="text-sm text-white">
                      <div>Claps: {clapProfile.primaryPattern.clapCount}</div>
                      <div>Intervals: {clapProfile.primaryPattern.timingIntervals.map((t) => `${t}ms`).join(', ')}</div>
                    </div>
                  </div>
                )}

                {/* Detection Results */}
                {feedback.detectionResult && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                    <div className="text-xs text-green-400 mb-2">Detection Result</div>
                    <div className="text-sm text-white space-y-1 font-mono">
                      <div>Detected: {feedback.detectionResult.detected ? 'YES' : 'NO'}</div>
                      <div>Claps: {feedback.detectionResult.clapCount}</div>
                      <div>Confidence: {feedback.detectionResult.confidence}%</div>
                      <div>Threshold: {feedback.detectionResult.threshold.toFixed(2)}</div>
                      <div>Frames: {feedback.detectionResult.analysisFrameCount}</div>
                      {feedback.detectionResult.detectedPattern && (
                        <div>
                          <div>Intervals: {feedback.detectionResult.detectedPattern.timingIntervals.map((t) => `${t}ms`).join(', ')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Comparison Results */}
                {feedback.comparisonResult && (
                  <div
                    className={`rounded-lg border p-3 ${
                      feedback.comparisonResult.match ? 'bg-accent/10 border-accent/30' : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className={`text-xs mb-2 ${feedback.comparisonResult.match ? 'text-accent' : 'text-red-400'}`}>
                      Pattern Comparison
                    </div>
                    <div className="text-sm text-white space-y-1 font-mono">
                      <div>Match: {feedback.comparisonResult.match ? '✓ TRUE' : '✗ FALSE'}</div>
                      <div>Pattern Match Score: {feedback.comparisonResult.confidence}%</div>
                      <div>Clap Count: {feedback.comparisonResult.clapCountMatch ? '✓' : '✗'}</div>
                      <div>Timing Variance: {feedback.comparisonResult.timingVariance}%</div>
                      <div>Reason: {feedback.comparisonResult.reason}</div>
                      <div className="text-xs text-secondary mt-2">Stored Pattern: {feedback.comparisonResult.details.expectedCount} claps</div>
                      <div className="text-xs text-secondary">Stored Intervals: {feedback.comparisonResult.details.expectedIntervals.map((t) => `${t}ms`).join(', ') || 'N/A'}</div>
                      <div className="text-xs text-secondary">Current Pattern: {feedback.comparisonResult.details.detectedCount} claps</div>
                      <div className="text-xs text-secondary">Current Intervals: {feedback.comparisonResult.details.detectedIntervals.map((t) => `${t}ms`).join(', ') || 'N/A'}</div>
                    </div>
                  </div>
                )}

                {/* Real-time Audio Meter */}
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-secondary mb-2">Live Audio Meter</div>
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono text-white">
                    <div>Device: {deviceLabel || 'None'}</div>
                    <div>Status: {micStatus}</div>
                    <div>Peak: {meterFrame ? meterFrame.peakAmplitude.toFixed(3) : '—'}</div>
                    <div>RMS: {meterFrame ? meterFrame.rmsAmplitude.toFixed(3) : '—'}</div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-purple-400 transition-all"
                      style={{ width: `${Math.min(100, (meterFrame?.peakAmplitude ?? 0) * 120)}%` }}
                    />
                  </div>
                </div>

                {/* Threshold Control */}
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-secondary mb-2">Threshold / Sensitivity</div>
                  <div className="text-sm text-white font-mono">Threshold: {threshold.toFixed(2)}</div>
                  <input
                    type="range"
                    min={0.1}
                    max={0.35}
                    step={0.005}
                    value={threshold}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      setThreshold(value)
                      if (detectionEngineRef.current) {
                        detectionEngineRef.current.detectionThreshold = value
                      }
                    }}
                    className="mt-2 w-full"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {phase === 'idle' && (
                    <button
                      onClick={handleStartDetection}
                      className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-glow transition"
                    >
                      Start Detection
                    </button>
                  )}

                  {phase === 'listening' && (
                    <button
                      onClick={handleStop}
                      className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 transition"
                    >
                      Stop Early
                    </button>
                  )}

                  {phase === 'complete' && (
                    <button
                      onClick={handleReset}
                      className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 transition"
                    >
                      Test Again
                    </button>
                  )}

                  {phase === 'error' && (
                    <button
                      onClick={handleReset}
                      className="flex-1 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition"
                    >
                      Error - Reset
                    </button>
                  )}
                </div>

                <div className="text-xs text-secondary italic">
                  {phase === 'listening' && '👂 Listening for 6 seconds... Perform your clap pattern now!'}
                  {phase === 'idle' && 'Train a clap pattern first, then click Start Detection.'}
                  {phase === 'checking-mic' && 'Requesting microphone access...'}
                  {phase === 'error' && 'Error occurred while setting up microphone or audio analyzer.'}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
