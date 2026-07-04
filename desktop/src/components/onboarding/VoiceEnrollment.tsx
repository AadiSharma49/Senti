import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { audioCapture } from '../../services/audioCapture'
import { UtteranceRecorder, UtteranceRecorderState } from '../../services/utteranceRecorder'
import { voiceEmbeddingEngine, averageEmbeddings } from '../../services/voiceEmbeddingEngine'
import { useVoiceProfileStore } from '../../state/voiceProfileStore'
import { useVoiceAuthStore } from '../../state/voiceAuthStore'

const ENROLL_SAMPLES = 3

type Phase = 'intro' | 'preparing' | 'capturing' | 'done' | 'error'

interface VoiceEnrollmentProps {
  /** Called after a profile is successfully saved */
  onComplete?: () => void
}

/**
 * Guided voice enrollment: records the user's passphrase N times and
 * saves the averaged voiceprint as the voice profile.
 * Used by the setup wizard and the settings panel.
 */
export default function VoiceEnrollment({ onComplete }: VoiceEnrollmentProps) {
  const recorderRef = useRef<UtteranceRecorder | null>(null)
  const embeddingsRef = useRef<Float32Array[]>([])
  const startedMicRef = useRef(false)

  const [phase, setPhase] = useState<Phase>('intro')
  const [samplesDone, setSamplesDone] = useState(0)
  const [recorderState, setRecorderState] = useState<UtteranceRecorderState>('idle')
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setProfile = useVoiceProfileStore((s) => s.setProfile)

  const cleanup = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    if (startedMicRef.current) {
      audioCapture.stop()
      startedMicRef.current = false
    }
  }

  useEffect(() => {
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = async () => {
    setError(null)
    setPhase('preparing')
    embeddingsRef.current = []
    setSamplesDone(0)

    // Never fight the lock-screen voice session for the microphone
    useVoiceAuthStore.getState().stopSession()

    try {
      await voiceEmbeddingEngine.load()
      await audioCapture.start()
      startedMicRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone or voice engine unavailable')
      setPhase('error')
      return
    }

    const recorder = new UtteranceRecorder()
    recorderRef.current = recorder
    recorder.onStateChange((s) => setRecorderState(s))
    recorder.onUtterance(async (utterance) => {
      if (embeddingsRef.current.length >= ENROLL_SAMPLES) return
      setComputing(true)
      try {
        const embedding = await voiceEmbeddingEngine.computeEmbedding(utterance)
        embeddingsRef.current.push(embedding)
        setSamplesDone(embeddingsRef.current.length)

        if (embeddingsRef.current.length >= ENROLL_SAMPLES) {
          const averaged = averageEmbeddings(embeddingsRef.current)
          setProfile({
            embedding: Array.from(averaged),
            sampleCount: embeddingsRef.current.length,
            modelId: 'wespeaker-voxceleb-resnet34-LM',
            createdAt: new Date().toISOString(),
          })
          cleanup()
          setPhase('done')
          onComplete?.()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Voiceprint computation failed')
        cleanup()
        setPhase('error')
      } finally {
        setComputing(false)
      }
    })
    recorder.start(audioCapture)
    setPhase('capturing')
  }

  const statusText =
    phase === 'capturing'
      ? computing
        ? 'Processing your voice…'
        : recorderState === 'recording'
        ? 'Recording — keep speaking…'
        : `Say your passphrase (${samplesDone}/${ENROLL_SAMPLES} captured)`
      : ''

  return (
    <div className="grid gap-4">
      {phase === 'intro' && (
        <>
          <p className="text-sm text-secondary">
            Senti will learn your voice. Choose a passphrase of at least 4–5 words
            (for example: <span className="text-white/80">“my voice is my password, open Senti”</span>)
            and say it the same way {ENROLL_SAMPLES} times.
          </p>
          <button
            onClick={handleStart}
            className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-black hover:bg-accent-glow transition justify-self-start"
          >
            Start Voice Enrollment
          </button>
        </>
      )}

      {phase === 'preparing' && (
        <div className="text-sm text-secondary">Preparing microphone and voice engine…</div>
      )}

      {phase === 'capturing' && (
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            {Array.from({ length: ENROLL_SAMPLES }).map((_, i) => (
              <motion.div
                key={i}
                className={`h-3 w-3 rounded-full ${i < samplesDone ? 'bg-accent' : 'bg-white/15'}`}
                animate={
                  i === samplesDone && recorderState === 'recording'
                    ? { scale: [1, 1.4, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.8, repeat: i === samplesDone ? Infinity : 0 }}
              />
            ))}
            <motion.div
              className={`ml-2 h-2 w-2 rounded-full ${recorderState === 'recording' ? 'bg-red-400' : 'bg-accent/60'}`}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          </div>
          <div className="text-sm text-white/80">{statusText}</div>
          <div className="text-xs text-secondary">
            Speak naturally, pause between repetitions. Background noise is ignored.
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-300">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
          Voice enrolled. Senti now recognizes your voice.
        </div>
      )}

      {phase === 'error' && (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error || 'Voice enrollment failed.'}
          </div>
          <button
            onClick={handleStart}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5 transition justify-self-start"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
