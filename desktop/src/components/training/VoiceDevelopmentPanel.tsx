import React from 'react'
import { VoiceComparisonResult } from '../../services/voiceValidationService'

interface VoiceDevelopmentPanelProps {
  micStatus: string
  deviceLabel: string
  permissionStatus: string
  transcript: string
  confidence: number
  language: string
  comparison: VoiceComparisonResult | null
  wakePhraseMode: boolean
  listening: boolean
  events?: string[]
  backendConnected: boolean
  modelLoaded: boolean
  lastChunkId: number | null
  lastBackendMessage: string
}

const statusText = (value: boolean) => (value ? 'TRUE' : 'FALSE')

export default function VoiceDevelopmentPanel({
  micStatus,
  deviceLabel,
  permissionStatus,
  transcript,
  confidence,
  language,
  comparison,
  wakePhraseMode,
  listening,
  events = [],
  backendConnected,
  modelLoaded,
  lastChunkId,
  lastBackendMessage,
}: VoiceDevelopmentPanelProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-accent">Live Voice Pipeline</div>
          <div className="text-sm text-secondary">Microphone to Electron IPC to Python to Faster-Whisper.</div>
        </div>
        <div className="rounded-full bg-slate-900 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
          {listening ? 'Listening' : 'Idle'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Backend Connected</div>
          <div className="mt-2 text-2xl text-white">{statusText(backendConnected)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Model Loaded</div>
          <div className="mt-2 text-2xl text-white">{statusText(modelLoaded)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Microphone Active</div>
          <div className="mt-2 text-2xl text-white">{statusText(micStatus === 'active')}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Microphone Status</div>
          <div className="mt-2 text-sm text-white">{micStatus}</div>
          <div className="text-xs text-slate-400">Permission: {permissionStatus}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Selected Device</div>
          <div className="mt-2 text-sm text-white">{deviceLabel || 'Default microphone'}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
        <div className="text-xs uppercase tracking-[0.3em] text-secondary">Last Transcript</div>
        <div className="mt-2 min-h-[54px] whitespace-pre-wrap break-words text-sm text-white">
          {transcript ? `"${transcript}"` : 'Waiting for Faster-Whisper result...'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Stored Phrase</div>
          <div className="mt-2 text-sm text-white">{comparison ? `"${comparison.normalizedStored}"` : 'Not compared yet'}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Detected Phrase</div>
          <div className="mt-2 text-sm text-white">{comparison ? `"${comparison.normalizedDetected}"` : transcript || 'Pending'}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Confidence</div>
          <div className="mt-2 text-2xl text-white">{confidence ? `${confidence}%` : '-'}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Language</div>
          <div className="mt-2 text-2xl text-white">{language}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Match</div>
          <div className="mt-2 text-2xl text-white">{comparison ? (comparison.match ? 'TRUE' : 'FALSE') : 'PENDING'}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-secondary">Chunk</div>
          <div className="mt-2 text-2xl text-white">{lastChunkId ?? '-'}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-secondary">
        <div>Phrase comparison: {wakePhraseMode ? 'enabled' : 'disabled'}</div>
        <div>Backend: {lastBackendMessage}</div>
        {comparison && <div className="mt-2">{comparison.reason}</div>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
        <div className="text-xs uppercase tracking-[0.3em] text-secondary">Pipeline Events</div>
        <div className="mt-2 text-sm text-slate-300 max-h-32 overflow-auto">
          {events.length ? (
            events.slice().reverse().map((event, index) => (
              <div key={`${index}-${event}`} className="text-xs py-1">{event}</div>
            ))
          ) : (
            <div className="text-xs text-slate-500">No events yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
