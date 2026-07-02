import React, { useEffect, useRef, useState } from 'react'
import { AudioCapture } from '../../services/audioCapture'
import { VoiceActivityDetector } from '../../services/voiceActivityDetector'
import type { AudioLevel } from '../../types/audio'

export default function VADTest() {
  const captureRef = useRef<AudioCapture | null>(null)
  const vadRef = useRef<VoiceActivityDetector | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [vadState, setVadState] = useState<'silent' | 'speaking'>('silent')
  const [level, setLevel] = useState<AudioLevel>({ rms: 0, peak: 0, clipped: false })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
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
      if (captureRef.current) captureRef.current.dispose()
      if (vadRef.current) vadRef.current.stop()
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

    captureRef.current.onStatusChange((s) => {
      if (s.error) setPermissionGranted(false)
    })

    captureRef.current.subscribe((_frame, lvl) => {
      setLevel(lvl)
    })

    const vad = new VoiceActivityDetector()
    vadRef.current = vad
    vad.onStateChange((state) => {
      setVadState(state)
    })
    vad.start(captureRef.current)
  }

  const handleStop = () => {
    if (vadRef.current) {
      vadRef.current.stop()
      vadRef.current = null
    }
    if (captureRef.current) {
      captureRef.current.dispose()
      captureRef.current = null
    }
    setRecording(false)
    setPermissionGranted(false)
    setVadState('silent')
    setLevel({ rms: 0, peak: 0, clipped: false })
  }

  const handleDispose = () => {
    handleStop()
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-xl border border-white/20 bg-black/90 p-6 text-white w-72">
        <h3 className="text-sm font-semibold mb-4 text-accent">VAD Test</h3>

        <div className="space-y-2 text-xs mb-4">
          <div>Permission: {permissionGranted ? 'Granted' : 'Not granted'}</div>
          <div>Recording: {recording ? 'Active' : 'Stopped'}</div>
          <div>VAD State: {vadState === 'silent' ? 'Silent' : 'Speaking'}</div>
          <div>RMS: {level.rms.toFixed(4)}</div>
          <div>Threshold: 0.02</div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min(100, (level.rms / 0.05) * 100)}%` }}
            />
          </div>
          <div
            className="h-0.5 bg-accent/60"
            style={{ marginLeft: `${(0.02 / 0.05) * 100}%`, width: '1px' }}
          />
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
            Start Capture
          </button>
          <button
            onClick={handleStop}
            disabled={!recording}
            className="w-full px-3 py-1.5 rounded bg-red-500/80 text-xs hover:bg-red-500 disabled:opacity-50"
          >
            Stop Capture
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