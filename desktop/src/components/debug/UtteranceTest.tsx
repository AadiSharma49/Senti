import React, { useEffect, useRef, useState } from 'react'
import { AudioCapture } from '../../services/audioCapture'
import { UtteranceRecorder, UtteranceRecorderState } from '../../services/utteranceRecorder'
import type { AudioLevel, Utterance } from '../../types/audio'

const MAX_KEPT_UTTERANCES = 5

export default function UtteranceTest() {
  const captureRef = useRef<AudioCapture | null>(null)
  const recorderRef = useRef<UtteranceRecorder | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recorderState, setRecorderState] = useState<UtteranceRecorderState>('idle')
  const [level, setLevel] = useState<AudioLevel>({ rms: 0, peak: 0, clipped: false })
  const [utterances, setUtterances] = useState<Utterance[]>([])
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
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
    return () => {
      if (recorderRef.current) recorderRef.current.stop()
      if (captureRef.current) captureRef.current.dispose()
      if (playbackCtxRef.current) playbackCtxRef.current.close().catch(() => {})
    }
  }, [])

  const handleRequestPermission = async () => {
    if (captureRef.current) return
    const capture = new AudioCapture()
    captureRef.current = capture
    const granted = await capture.requestPermission()
    setPermissionGranted(granted)
  }

  const handleStart = async () => {
    if (!captureRef.current || recording) return
    await captureRef.current.start()
    setRecording(true)

    captureRef.current.subscribe((_frame, lvl) => {
      setLevel(lvl)
    })

    const recorder = new UtteranceRecorder()
    recorderRef.current = recorder
    recorder.onStateChange((state) => {
      setRecorderState(state)
    })
    recorder.onUtterance((utterance) => {
      setUtterances((prev) => [utterance, ...prev].slice(0, MAX_KEPT_UTTERANCES))
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
    setRecording(false)
    setPermissionGranted(false)
    setRecorderState('idle')
    setLevel({ rms: 0, peak: 0, clipped: false })
  }

  const handleDispose = () => {
    handleStop()
    setUtterances([])
    setIsOpen(false)
  }

  const handlePlay = (utterance: Utterance, index: number) => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext()
    }
    const ctx = playbackCtxRef.current
    const buffer = ctx.createBuffer(1, utterance.samples.length, utterance.sampleRate)
    buffer.getChannelData(0).set(utterance.samples)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => setPlayingIndex(null)
    setPlayingIndex(index)
    source.start()
  }

  if (!isOpen) return null

  const stateLabel =
    recorderState === 'recording' ? 'Recording…' : recorderState === 'listening' ? 'Listening' : 'Idle'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-xl border border-white/20 bg-black/90 p-6 text-white w-80">
        <h3 className="text-sm font-semibold mb-4 text-accent">Utterance Recorder Test</h3>

        <div className="space-y-2 text-xs mb-4">
          <div>Permission: {permissionGranted ? 'Granted' : 'Not granted'}</div>
          <div>Capture: {recording ? 'Active' : 'Stopped'}</div>
          <div>
            Recorder:{' '}
            <span className={recorderState === 'recording' ? 'text-red-400 font-semibold' : ''}>
              {stateLabel}
            </span>
          </div>
          <div>RMS: {level.rms.toFixed(4)}</div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min(100, (level.rms / 0.05) * 100)}%` }}
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-secondary mb-2">Captured utterances ({utterances.length})</div>
          <div className="space-y-1 max-h-36 overflow-auto">
            {utterances.length === 0 && (
              <div className="text-xs text-white/40">Speak a sentence to capture one.</div>
            )}
            {utterances.map((u, i) => (
              <div key={u.timestamp} className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-xs">
                <span>
                  {u.duration.toFixed(2)}s · {(u.samples.length / 1000).toFixed(0)}k samples
                </span>
                <button
                  onClick={() => handlePlay(u, i)}
                  disabled={playingIndex !== null}
                  className="rounded bg-accent/80 px-2 py-0.5 text-black hover:bg-accent disabled:opacity-50"
                >
                  {playingIndex === i ? 'Playing…' : 'Play'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleRequestPermission}
            disabled={permissionGranted}
            className="w-full px-3 py-1.5 rounded bg-white/10 text-xs hover:bg-white/20 disabled:opacity-50"
          >
            Request Permission
          </button>
          <button
            onClick={handleStart}
            disabled={!permissionGranted || recording}
            className="w-full px-3 py-1.5 rounded bg-accent text-black text-xs hover:bg-accent-glow disabled:opacity-50"
          >
            Start Listening
          </button>
          <button
            onClick={handleStop}
            disabled={!recording}
            className="w-full px-3 py-1.5 rounded bg-red-500/80 text-xs hover:bg-red-500 disabled:opacity-50"
          >
            Stop
          </button>
          <button
            onClick={handleDispose}
            className="w-full px-3 py-1.5 rounded bg-white/5 text-xs hover:bg-white/10"
          >
            Dispose
          </button>
        </div>
      </div>
    </div>
  )
}
