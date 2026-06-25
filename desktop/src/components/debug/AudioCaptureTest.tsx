import React, { useEffect, useRef, useState } from 'react'
import { AudioCapture } from '../../services/audioCapture'
import type { AudioLevel, MicrophoneStatus } from '../../types/audio'

export default function AudioCaptureTest() {
  const captureRef = useRef<AudioCapture | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState<MicrophoneStatus>({
    state: 'idle',
    error: null,
    deviceLabel: null,
    sampleRate: null,
  })
  const [level, setLevel] = useState<AudioLevel>({ rms: 0, peak: 0, clipped: false })
  const subscriberCountRef = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
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
      if (captureRef.current) {
        captureRef.current.dispose()
      }
    }
  }, [])

  const handleRequestPermission = async () => {
    if (captureRef.current) return
    const capture = new AudioCapture()
    captureRef.current = capture
    const granted = await capture.requestPermission()
    setPermissionGranted(granted)
    if (granted) {
      setStatus(capture.getStatus())
    }
  }

  const handleStart = async () => {
    if (!captureRef.current || recording) return
    await captureRef.current.start()
    setRecording(true)
    subscriberCountRef.current = 1

    captureRef.current.onStatusChange((s) => {
      setStatus(s)
    })

    captureRef.current.subscribe((_frame, lvl) => {
      setLevel(lvl)
    })
  }

  const handleStop = () => {
    if (!captureRef.current || !recording) return
    captureRef.current.dispose()
    subscriberCountRef.current = 0
    setRecording(false)
    setPermissionGranted(false)
    setStatus({ state: 'idle', error: null, deviceLabel: null, sampleRate: null })
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
        <h3 className="text-sm font-semibold mb-4 text-accent">Audio Capture Test</h3>

        <div className="space-y-2 text-xs mb-4">
          <div>Permission: {permissionGranted ? 'Granted' : 'Not granted'}</div>
          <div>Recording: {recording ? 'Active' : 'Stopped'}</div>
          <div>State: {status.state}</div>
          <div>Device: {status.deviceLabel || 'None'}</div>
          <div>Sample Rate: {status.sampleRate || '—'}</div>
          <div>RMS: {level.rms.toFixed(4)}</div>
          <div>Peak: {level.peak.toFixed(4)}</div>
          <div>Clipped: {level.clipped ? 'Yes' : 'No'}</div>
          <div>Subscribers: {subscriberCountRef.current}</div>
          {status.error && <div className="text-red-400">Error: {status.error}</div>}
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