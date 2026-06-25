# Audio Architecture — Senti Phase 4

## Overview

The audio layer is a reusable microphone capture foundation that supplies raw PCM Float32 audio frames and RMS volume levels to downstream authentication engines.

```
                    ┌─────────────────────────────────────┐
                    │         AudioCapture                │
                    │         (singleton service)         │
                    └─────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
           ┌─────────────────┐  ┌─────────────────┐
           │   Frame         │  │   Level         │
           │   subscribers   │  │   subscribers   │
           │   (Float32 PCM) │  │   (RMS/Peak)    │
           └────────┬────────┘  └────────┬────────┘
                    │                     │
         ┌──────────┼──────────┐          │
         │          │          │          │
         ▼          ▼          ▼          │
   ┌─────────┐ ┌─────────┐ ┌─────────┐   │
   │ Voice   │ │ Clap    │ │ Wake    │   │
   │ Engine  │ │ Engine  │ │ Word    │   │
   └─────────┘ └─────────┘ └─────────┘   │
                                          │
   (All engines receive the same          │
    raw Float32Array samples + RMS level) │
                                          │
         ┌────────────────────────────────┘
         │
         ▼
   ┌──────────────┐
   │  lockStore   │
   │  authSuccess │
   │  authFail    │
   └──────────────┘
```

## Data Flow

```
navigator.mediaDevices.getUserMedia({ audio: true })
         │
         ▼
    MediaStream
         │
         ▼
    AudioContext.createMediaStreamSource(stream)
         │
         ▼
    AnalyserNode (fftSize: 2048)
         │
         ▼
    requestAnimationFrame loop (~60fps)
         │
         ├── getFloatTimeDomainData(dataArray)
         │       → Float32Array of raw PCM samples (-1.0 to 1.0)
         │
         └── compute RMS + Peak
                 → AudioLevel { rms, peak, clipped }
                 │
                 ▼
           AudioFrameCallback(frame, level)
                 │
                 ├── VoiceEngine.process(frame)
                 ├── ClapEngine.process(frame)
                 └── FutureEngine.process(frame)
```

## Public API

### `AudioCapture` class

| Method | Returns | Description |
|--------|---------|-------------|
| `requestPermission()` | `Promise<boolean>` | Request mic permission without starting capture |
| `start()` | `Promise<void>` | Start microphone, begin audio frame loop |
| `stop()` | `void` | Stop microphone, release all resources |
| `isRecording()` | `boolean` | Check if mic is active |
| `getCurrentLevel()` | `AudioLevel` | Last computed RMS/peak level |
| `getStatus()` | `MicrophoneStatus` | Full status object |
| `subscribe(cb)` | `() => void` | Subscribe to raw audio frames, returns unsubscribe |
| `onStatusChange(cb)` | `() => void` | Subscribe to status changes, returns unsubscribe |
| `dispose()` | `void` | Full cleanup of all resources and listeners |

### Types (`src/types/audio.ts`)

| Type | Fields |
|------|--------|
| `AudioCaptureState` | `'idle' \| 'requesting' \| 'active' \| 'error'` |
| `AudioLevel` | `{ rms: number, peak: number, clipped: boolean }` |
| `AudioFrame` | `{ samples: Float32Array, sampleRate: number, channels: number, timestamp: number, duration: number }` |
| `AudioBuffer` | `{ frames: AudioFrame[], totalDuration: number, maxFrames: number }` |
| `MicrophoneStatus` | `{ state, error, deviceLabel, sampleRate }` |
| `AudioFrameCallback` | `(frame: AudioFrame, level: AudioLevel) => void` |
| `AudioStatusCallback` | `(status: MicrophoneStatus) => void` |
| `AudioCaptureConfig` | `{ sampleRate?, fftSize?, frameDuration?, maxBufferFrames? }` |

### Default Configuration

```typescript
{
  sampleRate: 44100,     // Hz
  fftSize: 2048,         // AnalyserNode FFT size
  frameDuration: 0.05,   // 50ms per frame (~60fps capture loop)
  maxBufferFrames: 40,   // 2 seconds of buffered audio at 50ms
}
```

## Resource Lifecycle

```
Constructor
    │
    ▼
  idle ──requestPermission()──► requesting ──(stream obtained)──► idle
    │
    ├──start()──► requesting ──► active ──stop()──► idle
    │                                    │
    │                                    └──dispose()──► (cleared)
    │
    └──dispose()──► (cleared)
```

## Future Integration Plan

| Phase | Engine | Subscribes To | Uses |
|-------|--------|---------------|------|
| Phase 5 | Voice Engine | `AudioFrame` samples | Phrase transcription + embedding comparison |
| Phase 6 | Clap Engine | `AudioFrame` samples + `AudioLevel` | Energy envelope + peak detection + DTW |
| Phase 7 | Wake Word | `AudioFrame` samples | Continuous keyword spotting |

All engines share the same `AudioCapture` instance. Each engine subscribes with `audioCapture.subscribe(callback)` and receives the same raw Float32 samples and RMS level independently.

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Microphone permission can be requested without starting capture | ✅ |
| 2 | Microphone starts and produces audio frames | ✅ |
| 3 | Microphone stops and releases resources | ✅ |
| 4 | Audio level (RMS/Peak) updates continuously | ✅ |
| 5 | Raw Float32 PCM samples available via subscribe | ✅ |
| 6 | Memory cleaned correctly on stop/dispose | ✅ |
| 7 | No authentication logic in audio layer | ✅ |
| 8 | No UI changes required | ✅ |
| 9 | No Electron IPC or backend required | ✅ |
| 10 | Build passes with zero errors | ✅ |

## Files Created

| File | Purpose |
|------|---------|
| `src/types/audio.ts` | All strongly-typed interfaces |
| `src/services/audioCapture.ts` | Audio capture service implementation |
| `AUDIO_ARCHITECTURE.md` | This document |