import React, { useEffect, useRef, useState } from 'react'
import { AudioCapture } from '../../services/audioCapture'
import { UtteranceRecorder, UtteranceRecorderState } from '../../services/utteranceRecorder'
import {
  voiceEmbeddingEngine,
  EngineState,
  cosineSimilarity,
  averageEmbeddings,
} from '../../services/voiceEmbeddingEngine'
import { useVoiceProfileStore } from '../../state/voiceProfileStore'
import type { Utterance } from '../../types/audio'

const ENROLL_SAMPLES = 3
const MAX_RESULTS = 6

interface VerifyResult {
  id: number
  score: number
  match: boolean
  duration: number
}

export default function VoiceAuthTest() {
  const captureRef = useRef<AudioCapture | null>(null)
  const recorderRef = useRef<UtteranceRecorder | null>(null)
  const enrollBufferRef = useRef<Float32Array[]>([])
  const enrollingRef = useRef(false)
  const busyRef = useRef(false)
  const resultIdRef = useRef(0)

  const [isOpen, setIsOpen] = useState(false)
  const [engineState, setEngineState] = useState<EngineState>(voiceEmbeddingEngine.getState())
  const [engineError, setEngineError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [listening, setListening] = useState(false)
  const [recorderState, setRecorderState] = useState<UtteranceRecorderState>('idle')
  const [enrollProgress, setEnrollProgress] = useState(0)
  const [enrolling, setEnrolling] = useState(false)
  const [computing, setComputing] = useState(false)
  const [results, setResults] = useState<VerifyResult[]>([])

  const { profile, threshold, setProfile, clearProfile, setThreshold } = useVoiceProfileStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyE') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    const unsub = voiceEmbeddingEngine.onStateChange((state, error) => {
      setEngineState(state)
      setEngineError(error ?? null)
    })
    return unsub
  }, [])

  useEffect(() => {
    return () => {
      if (recorderRef.current) recorderRef.current.stop()
      if (captureRef.current) captureRef.current.dispose()
    }
  }, [])

  const handleLoadModel = () => {
    voiceEmbeddingEngine.load().catch(() => {})
  }

  const handleRequestPermission = async () => {
    if (captureRef.current) return
    const capture = new AudioCapture()
    captureRef.current = capture
    const granted = await capture.requestPermission()
    setPermissionGranted(granted)
  }

  const handleUtterance = async (utterance: Utterance) => {
    if (busyRef.current) return
    busyRef.current = true
    setComputing(true)
    try {
      const embedding = await voiceEmbeddingEngine.computeEmbedding(utterance)

      if (enrollingRef.current) {
        enrollBufferRef.current.push(embedding)
        setEnrollProgress(enrollBufferRef.current.length)
        if (enrollBufferRef.current.length >= ENROLL_SAMPLES) {
          const averaged = averageEmbeddings(enrollBufferRef.current)
          useVoiceProfileStore.getState().setProfile({
            embedding: Array.from(averaged),
            sampleCount: enrollBufferRef.current.length,
            modelId: 'wespeaker-voxceleb-resnet34-LM',
            createdAt: new Date().toISOString(),
          })
          enrollBufferRef.current = []
          enrollingRef.current = false
          setEnrolling(false)
          setEnrollProgress(0)
        }
      } else {
        const currentProfile = useVoiceProfileStore.getState().profile
        if (currentProfile) {
          const score = cosineSimilarity(embedding, currentProfile.embedding)
          const currentThreshold = useVoiceProfileStore.getState().threshold
          setResults((prev) =>
            [
              {
                id: resultIdRef.current++,
                score,
                match: score >= currentThreshold,
                duration: utterance.duration,
              },
              ...prev,
            ].slice(0, MAX_RESULTS)
          )
        }
      }
    } catch {
      // engine errors surface via onStateChange
    } finally {
      busyRef.current = false
      setComputing(false)
    }
  }

  const handleStart = async () => {
    if (!captureRef.current || listening) return
    await voiceEmbeddingEngine.load().catch(() => {})
    await captureRef.current.start()
    setListening(true)

    const recorder = new UtteranceRecorder()
    recorderRef.current = recorder
    recorder.onStateChange((state) => setRecorderState(state))
    recorder.onUtterance((u) => {
      void handleUtterance(u)
    })
    recorder.start(captureRef.current)
  }

  const handleStop = () => {
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
    }
    if (captureRef.current) {
      captureRef.current.dispose()
      captureRef.current = null
    }
    enrollingRef.current = false
    enrollBufferRef.current = []
    setListening(false)
    setPermissionGranted(false)
    setRecorderState('idle')
    setEnrolling(false)
    setEnrollProgress(0)
  }

  const handleEnroll = () => {
    enrollBufferRef.current = []
    enrollingRef.current = true
    setEnrolling(true)
    setEnrollProgress(0)
    setResults([])
  }

  const handleResetProfile = () => {
    clearProfile()
    setResults([])
  }

  const handleDispose = () => {
    handleStop()
    setResults([])
    setIsOpen(false)
  }

  if (!isOpen) return null

  const engineLabel =
    engineState === 'ready'
      ? 'Ready'
      : engineState === 'loading'
      ? 'Loading model…'
      : engineState === 'error'
      ? 'Error'
      : 'Not loaded'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-xl border border-white/20 bg-black/90 p-6 text-white w-96">
        <h3 className="text-sm font-semibold mb-4 text-accent">Voice Auth Test</h3>

        <div className="space-y-2 text-xs mb-4">
          <div>
            Model:{' '}
            <span className={engineState === 'ready' ? 'text-green-400' : engineState === 'error' ? 'text-red-400' : ''}>
              {engineLabel}
            </span>
            {engineError && <span className="text-red-400"> — {engineError}</span>}
          </div>
          <div>Permission: {permissionGranted ? 'Granted' : 'Not granted'}</div>
          <div>
            Listening: {listening ? (recorderState === 'recording' ? 'Recording…' : 'Yes') : 'No'}
            {computing && <span className="text-accent"> · computing voiceprint…</span>}
          </div>
          <div>
            Profile:{' '}
            {profile ? (
              <span className="text-green-400">
                Enrolled ({profile.sampleCount} samples, {new Date(profile.createdAt).toLocaleDateString()})
              </span>
            ) : (
              <span className="text-white/50">Not enrolled</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Threshold: {threshold.toFixed(2)}</span>
            <input
              type="range"
              min={0.3}
              max={0.7}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>

        {enrolling && (
          <div className="mb-4 rounded border border-accent/40 bg-accent/10 p-3 text-xs">
            <div className="font-semibold text-accent mb-1">
              Enrolling — just speak ({enrollProgress}/{ENROLL_SAMPLES})
            </div>
            <div>Say anything naturally, {ENROLL_SAMPLES} times, pausing between each.</div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-xs text-secondary mb-2">Verification results</div>
          <div className="space-y-1 max-h-36 overflow-auto">
            {results.length === 0 && (
              <div className="text-xs text-white/40">
                {profile ? 'Speak to verify against the enrolled profile.' : 'Enroll a profile first.'}
              </div>
            )}
            {results.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                  r.match ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'
                }`}
              >
                <span>{r.match ? 'MATCH' : 'NO MATCH'}</span>
                <span>
                  score {r.score.toFixed(3)} · {r.duration.toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleLoadModel}
            disabled={engineState === 'ready' || engineState === 'loading'}
            className="px-3 py-1.5 rounded bg-white/10 text-xs hover:bg-white/20 disabled:opacity-50"
          >
            Load Model
          </button>
          <button
            onClick={handleRequestPermission}
            disabled={permissionGranted}
            className="px-3 py-1.5 rounded bg-white/10 text-xs hover:bg-white/20 disabled:opacity-50"
          >
            Request Permission
          </button>
          <button
            onClick={handleStart}
            disabled={!permissionGranted || listening}
            className="px-3 py-1.5 rounded bg-accent text-black text-xs hover:bg-accent-glow disabled:opacity-50"
          >
            Start Listening
          </button>
          <button
            onClick={handleStop}
            disabled={!listening}
            className="px-3 py-1.5 rounded bg-red-500/80 text-xs hover:bg-red-500 disabled:opacity-50"
          >
            Stop
          </button>
          <button
            onClick={handleEnroll}
            disabled={!listening || enrolling || engineState !== 'ready'}
            className="px-3 py-1.5 rounded bg-accent/80 text-black text-xs hover:bg-accent disabled:opacity-50"
          >
            Enroll ({ENROLL_SAMPLES} samples)
          </button>
          <button
            onClick={handleResetProfile}
            disabled={!profile}
            className="px-3 py-1.5 rounded bg-white/10 text-xs hover:bg-white/20 disabled:opacity-50"
          >
            Reset Profile
          </button>
          <button
            onClick={handleDispose}
            className="col-span-2 px-3 py-1.5 rounded bg-white/5 text-xs hover:bg-white/10"
          >
            Dispose
          </button>
        </div>
      </div>
    </div>
  )
}
