import { microphoneCapture } from './microphoneCapture'

type SpeechRecognition = any
type SpeechRecognitionEvent = any

export type VoiceRecognitionStatus =
  | 'idle'
  | 'initializing'
  | 'requesting-permission'
  | 'ready'
  | 'listening'
  | 'stopped'
  | 'error'
  | 'unsupported'

export interface VoiceRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
  timestamp: number
}

export type VoiceRecognitionCallbacks = {
  onStatusChange?: (status: VoiceRecognitionStatus) => void
  onResult?: (result: VoiceRecognitionResult) => void
  onError?: (message: string) => void
  onEvent?: (message: string) => void
}

const createSpeechRecognition = (): SpeechRecognition | null => {
  const ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!ctor) {
    return null
  }
  return new ctor()
}

export class VoiceRecognitionEngine {
  private recognition: SpeechRecognition | null = null
  private status: VoiceRecognitionStatus = 'idle'
  private lastResult: VoiceRecognitionResult | null = null
  private callbacks: VoiceRecognitionCallbacks = {}
  private active = false
  private autoRestart = false
  private restartAttempts = 0
  private restartTimer: any = null

  get currentStatus() {
    return this.status
  }

  get lastTranscript() {
    return this.lastResult?.transcript ?? ''
  }

  get selectedDevice() {
    return microphoneCapture.selectedDeviceLabel
  }

  setCallbacks(callbacks: VoiceRecognitionCallbacks) {
    this.callbacks = callbacks
  }

  setAutoRestart(enabled: boolean) {
    this.autoRestart = !!enabled
  }

  private setStatus(status: VoiceRecognitionStatus) {
    if (this.status === status) return
    this.status = status
    this.callbacks.onStatusChange?.(status)
  }

  private emitResult(result: VoiceRecognitionResult) {
    this.lastResult = result
    this.callbacks.onResult?.(result)
  }

  private emitError(message: string) {
    console.warn('[VoiceRecognition] Error:', message)
    this.callbacks.onError?.(message)
    this.callbacks.onEvent?.(`[error] ${message}`)
  }

  async initialize(): Promise<boolean> {
    this.setStatus('requesting-permission')
    const stream = await microphoneCapture.getStream()
    if (!stream) {
      this.setStatus('error')
      this.emitError('Microphone permission was not granted or no device is available.')
      return false
    }

    const recognition = createSpeechRecognition()
    if (!recognition) {
      this.setStatus('unsupported')
      this.emitError('Web Speech API is not supported in this browser.')
      return false
    }

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      this.active = true
      this.setStatus('listening')
      this.restartAttempts = 0
      this.callbacks.onEvent?.('[event] recognition started')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      let confidence = 0
      let isFinal = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        transcript += result[0].transcript
        confidence = Math.max(confidence, result[0].confidence || 0)
        if (result.isFinal) {
          isFinal = true
        }
      }

      const normalized = transcript.trim()
      this.emitResult({
        transcript: normalized,
        confidence: Math.round(confidence * 100),
        isFinal,
        timestamp: Date.now(),
      })
      this.callbacks.onEvent?.(`[event] result: ${normalized} (final=${isFinal})`)
    }

    recognition.onerror = (event: any) => {
      const message = event?.error ? String(event.error) : 'Unknown speech recognition error'
      this.emitError(message)
      this.setStatus('error')
      this.callbacks.onEvent?.(`[event] recognition error: ${message}`)
    }

    recognition.onend = () => {
      this.active = false
      this.callbacks.onEvent?.('[event] recognition ended')
      if (this.status !== 'error' && this.status !== 'unsupported') {
        this.setStatus('stopped')
      }

      // Auto-restart logic: if unexpected end and autoRestart enabled, try to restart
      if (this.autoRestart && this.status !== 'error' && this.status !== 'unsupported') {
        this.restartAttempts += 1
        const delay = Math.min(1000 * this.restartAttempts, 5000)
        if (this.restartTimer) clearTimeout(this.restartTimer)
        this.restartTimer = setTimeout(async () => {
          try {
            await this.startListening()
            this.callbacks.onEvent?.('[event] recognition auto-restarted')
          } catch (e) {
            this.emitError('Auto-restart failed')
          }
        }, delay)
      }
    }

    this.recognition = recognition
    this.setStatus('ready')
    return true
  }

  async startListening(): Promise<boolean> {
    if (this.active) {
      return true
    }
    if (!this.recognition) {
      const initialized = await this.initialize()
      if (!initialized) {
        return false
      }
    }

    try {
      this.recognition?.start()
      return true
    } catch (error: any) {
      this.emitError(error?.message || 'Failed to start speech recognition')
      this.setStatus('error')
      return false
    }
  }

  stopListening() {
    if (!this.active) {
      return
    }
    try {
      this.recognition?.stop()
    } catch (error) {
      console.warn('[VoiceRecognition] stopListening failed:', error)
    }
  }

  reset() {
    this.lastResult = null
    this.setStatus('idle')
  }

  dispose() {
    this.stopListening()
    this.recognition = null
    this.active = false
    this.setStatus('idle')
  }
}
