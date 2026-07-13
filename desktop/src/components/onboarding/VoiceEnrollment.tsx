import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { audioCapture } from '../../services/audioCapture'
import { UtteranceRecorder, UtteranceRecorderState } from '../../services/utteranceRecorder'
import { voiceEmbeddingEngine, averageEmbeddings } from '../../services/voiceEmbeddingEngine'
import { useVoiceProfileStore } from '../../state/voiceProfileStore'
import { useVoiceAuthStore } from '../../state/voiceAuthStore'
import { uploadVoiceprint } from '../../services/voiceprintSync'
import type { Utterance } from '../../types/audio'

/**
 * Guided voice enrollment (voice-only).
 *
 * Senti must learn your VOICE, not a phrase. If every enrollment sample is the
 * same sentence, the averaged embedding drifts toward that sentence's sounds
 * and unlock only works when you repeat it. So we walk the user through
 * several DIFFERENT lines, and reject samples that are too short to carry a
 * reliable voiceprint. The result is text-independent: afterwards you can say
 * absolutely anything to unlock.
 */

/** Different lines on purpose — a varied voiceprint works with any words. */
const PROMPTS = [
  'Hey Senti, unlock my computer.',
  'The weather looks pretty good outside today.',
  'Let me get started with my work now.',
  'My voice is the only key I need.',
  'Play some music and tell me the news.',
]

const ENROLL_SAMPLES = PROMPTS.length

/** Anything shorter than this is too little audio for a reliable voiceprint. */
const MIN_ENROLL_SEC = 1.2

type Phase = 'intro' | 'preparing' | 'capturing' | 'done' | 'error'

interface VoiceEnrollmentProps {
  /** Called after a profile is successfully saved */
  onComplete?: () => void
}

export default function VoiceEnrollment({ onComplete }: VoiceEnrollmentProps) {
  const recorderRef = useRef<UtteranceRecorder | null>(null)
  const embeddingsRef = useRef<Float32Array[]>([])
  const startedMicRef = useRef(false)

  const [phase, setPhase] = useState<Phase>('intro')
  const [samplesDone, setSamplesDone] = useState(0)
  const [recorderState, setRecorderState] = useState<UtteranceRecorderState>('idle')
  const [computing, setComputing] = useState(false)
  const [tooShort, setTooShort] = useState(false)
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

  useEffect(() => cleanup, [])

  const handleUtterance = async (utterance: Utterance) => {
    if (embeddingsRef.current.length >= ENROLL_SAMPLES) return

    // Too brief to model a voice — ask for that line again.
    if (utterance.duration < MIN_ENROLL_SEC) {
      setTooShort(true)
      return
    }
    setTooShort(false)

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
        void uploadVoiceprint()
        onComplete?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voiceprint computation failed')
      cleanup()
      setPhase('error')
    } finally {
      setComputing(false)
    }
  }

  const beginCapture = async () => {
    setError(null)
    setTooShort(false)
    setPhase('preparing')
    embeddingsRef.current = []
    setSamplesDone(0)

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
    recorder.onUtterance((u) => void handleUtterance(u))
    recorder.start(audioCapture)
    setPhase('capturing')
  }

  const statusText = computing
    ? 'Learning your voice…'
    : recorderState === 'recording'
    ? 'Recording — keep going…'
    : `Read line ${Math.min(samplesDone + 1, ENROLL_SAMPLES)} of ${ENROLL_SAMPLES}`

  return (
    <div className="grid gap-4">
      {phase === 'intro' && (
        <>
          <p className="text-sm text-secondary">
            Senti will learn your voice, not a password. You will read {ENROLL_SAMPLES} short lines
            out loud — each one different on purpose, so afterwards you can unlock by saying
            absolutely anything, in any language.
          </p>
          <button
            onClick={beginCapture}
            className="justify-self-start rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-glow"
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
                  i === samplesDone && recorderState === 'recording' ? { scale: [1, 1.4, 1] } : { scale: 1 }
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

          {/* The line to read right now. */}
          <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
            <div className="text-xs uppercase tracking-[0.3em] text-accent">Say this</div>
            <div className="mt-2 text-lg text-white">
              {PROMPTS[Math.min(samplesDone, ENROLL_SAMPLES - 1)]}
            </div>
          </div>

          <div className="text-sm text-white/80">{statusText}</div>
          {tooShort ? (
            <div className="text-xs text-amber-300">
              That was too short — say the whole line, then pause.
            </div>
          ) : (
            <div className="text-xs text-secondary">
              Speak naturally at your normal pace, then pause.
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-300">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
          Voice enrolled. Now say anything at all to unlock.
        </div>
      )}

      {phase === 'error' && (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error || 'Voice enrollment failed.'}
          </div>
          <button
            onClick={() => setPhase('intro')}
            className="justify-self-start rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
