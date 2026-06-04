export type LiveVoiceCaptureStatus = 'idle' | 'requesting' | 'active' | 'stopped' | 'error'

export interface LiveVoiceCaptureCallbacks {
  onStatusChange?: (status: LiveVoiceCaptureStatus) => void
  onDeviceChange?: (deviceLabel: string) => void
  onChunkSent?: (chunkId: number) => void
  onError?: (message: string) => void
  onBackendStatus?: (data: any) => void
  onTranscript?: (transcript: string, confidence?: number, language?: string) => void
}

const TARGET_SAMPLE_RATE = 16000
const CHUNK_SECONDS = 2.5

const getSentiApi = () => {
  const api = (window as any).senti
  if (api?.voice?.start && api?.voice?.stop && api?.voice?.transcribe) {
    return {
      voiceStart: api.voice.start,
      voiceStop: api.voice.stop,
      voiceTranscribe: api.voice.transcribe,
      onBackendStatus: api.onBackendStatus,
    }
  }

  if (api?.voiceStart && api?.voiceStop && api?.voiceTranscribe) {
    return api
  }

  console.warn('[LiveVoiceCapture] Missing voice IPC methods:', {
    senti: api,
    voice: api?.voice,
    voiceStart: typeof api?.voiceStart,
    voiceStop: typeof api?.voiceStop,
    voiceTranscribe: typeof api?.voiceTranscribe,
  })
  return null
}

const floatToPcm16Base64 = (samples: Float32Array): string => {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  const bytes = new Uint8Array(pcm.buffer)
  let binary = ''
  const blockSize = 0x8000
  for (let i = 0; i < bytes.length; i += blockSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + blockSize))
  }
  return btoa(binary)
}

const downsampleTo16k = (input: Float32Array, inputSampleRate: number): Float32Array => {
  if (inputSampleRate === TARGET_SAMPLE_RATE) return input
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    for (let j = start; j < end; j++) {
      sum += input[j]
    }
    output[i] = sum / Math.max(1, end - start)
  }

  return output
}

export class LiveVoiceCapture {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private callbacks: LiveVoiceCaptureCallbacks = {}
  private backendListenerRemover: (() => void) | null = null
  private samples: number[] = []
  private chunkId = 0
  private active = false


  get isActive() {
    return this.active
  }

  setCallbacks(callbacks: LiveVoiceCaptureCallbacks) {
    this.callbacks = callbacks
  }

  onBackendStatus(cb: (data: any) => void) {
    this.callbacks.onBackendStatus = cb
    const api = getSentiApi()
    if (api?.onBackendStatus) {
      // register and keep remover for cleanup
      const remover = api.onBackendStatus((data: any) => {
        cb(data)
        // route transcript events to transcript callback as well
        if (data?.event === 'voice:transcript') {
          this.callbacks.onTranscript?.(String(data.transcript || ''), Number(data.confidence || 0), String(data.language || 'en'))
        }
      })
      this.backendListenerRemover = typeof remover === 'function' ? remover : null
    } else {
      console.warn('[LiveVoiceCapture] onBackendStatus not available on senti API')
    }
    return () => {
      if (this.backendListenerRemover) {
        this.backendListenerRemover()
        this.backendListenerRemover = null
      }
    }
  }

  onTranscript(
  cb: (
    transcript: string,
    confidence?: number,
    language?: string
  ) => void
) {
  this.callbacks.onTranscript = cb

  return () => {
    this.callbacks.onTranscript = undefined
  }
}

  private setStatus(status: LiveVoiceCaptureStatus) {
    this.callbacks.onStatusChange?.(status)
  }

  async start(deviceId?: string): Promise<boolean> {
    console.log('[LiveVoiceCapture.start] Beginning voice capture startup')
    if (this.active) {
      console.log('[LiveVoiceCapture.start] Already active, returning')
      return true
    }

    this.setStatus('requesting')
    try {
      console.log('[LiveVoiceCapture.start] Getting senti API')
      const senti = getSentiApi()
      if (!senti) {
        throw new Error('Electron voice bridge is unavailable. Start Senti with npm run electron:dev.')
      }

      console.log('[LiveVoiceCapture.start] Invoking voice:start IPC')
      await senti.voiceStart()
      console.log('[LiveVoiceCapture.start] voice:start IPC completed')
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      }
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId }
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      })

      const track = this.stream.getAudioTracks()[0]
      const deviceLabel = track?.label || 'Default microphone'
      console.log('[LiveVoiceCapture.start] Microphone stream acquired:', deviceLabel)
      this.callbacks.onDeviceChange?.(deviceLabel)

      console.log('[LiveVoiceCapture.start] Creating audio context')
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.samples = []
      this.chunkId = 0
      this.active = true

      this.processor.onaudioprocess = (event) => {
        if (!this.active || !this.audioContext) return

        const channel = event.inputBuffer.getChannelData(0)
        const downsampled = downsampleTo16k(channel, this.audioContext.sampleRate)
        for (let i = 0; i < downsampled.length; i++) {
          this.samples.push(downsampled[i])
        }

        const targetLength = TARGET_SAMPLE_RATE * CHUNK_SECONDS
        if (this.samples.length >= targetLength) {
          const chunk = new Float32Array(this.samples.splice(0, targetLength))
          console.log('[LiveVoiceCapture.onaudioprocess] Chunk ready, sending to backend')
          this.sendChunk(chunk)
        }
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      console.log('[LiveVoiceCapture.start] Audio pipeline connected')
      this.setStatus('active')
      console.log('[LiveVoiceCapture.start] Status set to active')
      return true
    } catch (error: any) {
      console.error('[LiveVoiceCapture.start] Failed:', error?.message)
      this.callbacks.onError?.(error?.message || 'Unable to start microphone capture')
      this.setStatus('error')
      this.stop()
      return false
    }
  }

  private async sendChunk(chunk: Float32Array) {
    const senti = getSentiApi()
    if (!senti) {
      console.error('[LiveVoiceCapture.sendChunk] Senti API unavailable')
      this.callbacks.onError?.('Electron voice bridge is unavailable.')
      return
    }

    const id = ++this.chunkId
    try {
      console.log('[LiveVoiceCapture.sendChunk] Sending chunk', id, 'to backend')
      await senti.voiceTranscribe({
        audio: floatToPcm16Base64(chunk),
        sampleRate: TARGET_SAMPLE_RATE,
        chunkId: id,
      })
      console.log('[LiveVoiceCapture.sendChunk] Chunk', id, 'sent successfully')
      this.callbacks.onChunkSent?.(id)
    } catch (error: any) {
      console.error('[LiveVoiceCapture.sendChunk] Error sending chunk:', error?.message)
    }
  }

  stop() {
    this.active = false
    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    getSentiApi()?.voiceStop().catch(() => {})
    this.setStatus('stopped')
  }
}
