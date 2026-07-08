import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { audioCapture } from '../../services/audioCapture'
import { UtteranceRecorder, UtteranceRecorderState } from '../../services/utteranceRecorder'
import { voiceEmbeddingEngine, averageEmbeddings } from '../../services/voiceEmbeddingEngine'
import { loadSpeechRecognition, transcribe, phraseSimilarity, normalizePhrase } from '../../services/speechRecognition'
import {
  useVoiceProfileStore,
  DEFAULT_PHRASE_THRESHOLD,
  type SecurityMode,
} from '../../state/voiceProfileStore'
import { useVoiceAuthStore } from '../../state/voiceAuthStore'
import { uploadVoiceprint } from '../../services/voiceprintSync'

const ENROLL_SAMPLES = 3
const MIN_PHRASE_WORDS = 2

type Phase = 'intro' | 'phrase' | 'preparing' | 'capturing' | 'done' | 'error'

interface VoiceEnrollmentProps {
  /** Which security mode this enrollment provisions. */
  mode: SecurityMode
  /** Called after a profile is successfully saved */
  onComplete?: () => void
}

/**
 * Guided voice enrollment. In phrase_and_voice mode the user chooses a
 * wake phrase and says it (learned from speech for consistency). In
 * voice_only mode they just provide voice samples. Result is a voiceprint
 * (+ optional phrase) plus the chosen security mode.
 */
export default function VoiceEnrollment({ mode, onComplete }: VoiceEnrollmentProps) {
  const usePhrase = mode === 'phrase_and_voice'

  const recorderRef = useRef<UtteranceRecorder | null>(null)
  const embeddingsRef = useRef<Float32Array[]>([])
  const startedMicRef = useRef(false)
  const phraseRef = useRef('')
  const targetRef = useRef('')

  const [phase, setPhase] = useState<Phase>(usePhrase ? 'phrase' : 'intro')
  const [phrase, setPhrase] = useState('')
  const [samplesDone, setSamplesDone] = useState(0)
  const [recorderState, setRecorderState] = useState<UtteranceRecorderState>('idle')
  const [computing, setComputing] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setProfile = useVoiceProfileStore((s) => s.setProfile)
  const setSecurityMode = useVoiceProfileStore((s) => s.setSecurityMode)

  const cleanup = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    if (startedMicRef.current) {
      audioCapture.stop()
      startedMicRef.current = false
    }
  }

  useEffect(() => cleanup, [])

  const phraseWordCount = normalizePhrase(phrase).split(' ').filter(Boolean).length

  const saveProfile = () => {
    const averaged = averageEmbeddings(embeddingsRef.current)
    setProfile({
      embedding: Array.from(averaged),
      phrase: usePhrase ? normalizePhrase(targetRef.current) : '',
      sampleCount: embeddingsRef.current.length,
      modelId: 'wespeaker-voxceleb-resnet34-LM',
      createdAt: new Date().toISOString(),
    })
    setSecurityMode(mode)
    cleanup()
    setPhase('done')
    // If linked to an account, sync the new voiceprint up to it.
    void uploadVoiceprint()
    onComplete?.()
  }

  const handleUtterance = async (utterance: Parameters<Parameters<UtteranceRecorder['onUtterance']>[0]>[0]) => {
    if (embeddingsRef.current.length >= ENROLL_SAMPLES) return
    setComputing(true)
    try {
      if (usePhrase) {
        const heard = await transcribe(utterance)
        if (!heard) {
          setHint('Didn’t catch that — say your phrase clearly.')
          return
        }
        if (targetRef.current === '') {
          targetRef.current = heard
        } else if (phraseSimilarity(heard, targetRef.current) < DEFAULT_PHRASE_THRESHOLD) {
          setHint(`Heard "${heard}". Please say it the same way each time.`)
          return
        }
      }

      const embedding = await voiceEmbeddingEngine.computeEmbedding(utterance)
      embeddingsRef.current.push(embedding)
      setSamplesDone(embeddingsRef.current.length)
      setHint(null)

      if (embeddingsRef.current.length >= ENROLL_SAMPLES) saveProfile()
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
    setHint(null)
    if (usePhrase) {
      if (phraseWordCount < MIN_PHRASE_WORDS) {
        setError(`Choose a wake phrase of at least ${MIN_PHRASE_WORDS} words.`)
        return
      }
      phraseRef.current = phrase
      targetRef.current = ''
    }
    setPhase('preparing')
    embeddingsRef.current = []
    setSamplesDone(0)

    useVoiceAuthStore.getState().stopSession()

    try {
      const loads: Promise<unknown>[] = [voiceEmbeddingEngine.load()]
      if (usePhrase) loads.push(loadSpeechRecognition())
      await Promise.all(loads)
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

  const statusText =
    phase === 'capturing'
      ? computing
        ? 'Listening…'
        : recorderState === 'recording'
        ? 'Recording — keep speaking…'
        : usePhrase
        ? `Say "${phraseRef.current}" (${samplesDone}/${ENROLL_SAMPLES})`
        : `Speak naturally (${samplesDone}/${ENROLL_SAMPLES})`
      : ''

  return (
    <div className="grid gap-4">
      {phase === 'phrase' && (
        <>
          <p className="text-sm text-secondary">
            Choose a wake phrase — the exact words you&apos;ll say to unlock. At least{' '}
            {MIN_PHRASE_WORDS} words, e.g. <span className="text-white/80">&ldquo;wake up senti&rdquo;</span>.
            You&apos;ll need the right words <span className="text-white/80">and</span> your voice.
          </p>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="Your wake phrase"
            className="input-glass"
            onKeyDown={(e) => e.key === 'Enter' && beginCapture()}
          />
          <button
            onClick={beginCapture}
            disabled={phraseWordCount < MIN_PHRASE_WORDS}
            className="justify-self-start rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-glow disabled:opacity-50"
          >
            Start Voice Enrollment
          </button>
        </>
      )}

      {phase === 'intro' && (
        <>
          <p className="text-sm text-secondary">
            Voice-only mode: any words unlock as long as it&apos;s your voice. Say a few
            natural sentences so Senti can learn how you sound.
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
          {usePhrase && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xs uppercase tracking-[0.25em] text-accent">Your wake phrase</div>
              <div className="mt-1 text-lg font-semibold text-white">&ldquo;{phraseRef.current}&rdquo;</div>
            </div>
          )}
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
          <div className="text-sm text-white/80">{statusText}</div>
          {hint && <div className="text-xs text-amber-300">{hint}</div>}
          <div className="text-xs text-secondary">Speak naturally, pause between repetitions.</div>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-300">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
          Voice enrolled. {usePhrase ? 'Say your wake phrase to unlock.' : 'Speak to unlock.'}
        </div>
      )}

      {phase === 'error' && (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error || 'Voice enrollment failed.'}
          </div>
          <button
            onClick={() => setPhase(usePhrase ? 'phrase' : 'intro')}
            className="justify-self-start rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
