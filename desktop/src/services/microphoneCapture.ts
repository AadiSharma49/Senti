/**
 * Microphone Capture Service
 *
 * Handles MediaDevices API, permission requests, and microphone stream management.
 * Provides clean error handling and status reporting.
 */

export type MicrophoneStatus = 'idle' | 'requesting' | 'active' | 'error' | 'permission-denied' | 'no-device'

export interface MicrophoneService {
  status: MicrophoneStatus
  stream: MediaStream | null
  selectedDeviceLabel: string | null
  requestAccess(): Promise<boolean>
  getStream(): Promise<MediaStream | null>
  stop(): void
  onStatusChange: (callback: (status: MicrophoneStatus) => void) => () => void
}

class MicrophoneCaptureImpl implements MicrophoneService {
  private _status: MicrophoneStatus = 'idle'
  private _stream: MediaStream | null = null
  private _selectedDeviceLabel: string | null = null
  private _statusCallbacks: Set<(status: MicrophoneStatus) => void> = new Set()

  constructor() {
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange)
    }
  }

  private handleDeviceChange = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasAudioInput = devices.some((device) => device.kind === 'audioinput')
      if (!hasAudioInput) {
        this._selectedDeviceLabel = null
        this.setStatus('no-device')
        return
      }
      if (this._stream) {
        await this.refreshDeviceLabel(this._stream)
      }
    } catch {
      this.setStatus('error')
    }
  }

  get status(): MicrophoneStatus {
    return this._status
  }

  get stream(): MediaStream | null {
    return this._stream
  }

  get selectedDeviceLabel(): string | null {
    return this._selectedDeviceLabel
  }

  private async refreshDeviceLabel(stream: MediaStream) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioTrack = stream.getAudioTracks()[0]
      const deviceId = audioTrack?.getSettings().deviceId
      const selected = devices.find((device) => device.kind === 'audioinput' && device.deviceId === deviceId)
      this._selectedDeviceLabel = selected?.label || 'Default microphone'
    } catch {
      this._selectedDeviceLabel = 'Unknown microphone'
    }
  }

  private setStatus(status: MicrophoneStatus) {
    if (this._status === status) return
    this._status = status
    this._statusCallbacks.forEach((cb) => cb(status))
  }

  async requestAccess(): Promise<boolean> {
    if (this._stream) return true

    this.setStatus('requesting')

    try {
      // Check if browser supports MediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[Microphone] Browser does not support MediaDevices API')
        this.setStatus('error')
        return false
      }

      // Check for available audio input devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasAudioInput = devices.some((d) => d.kind === 'audioinput')

      if (!hasAudioInput) {
        console.warn('[Microphone] No audio input device found')
        this.setStatus('no-device')
        return false
      }

      // Request microphone access
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      await this.refreshDeviceLabel(this._stream)
      console.log('[Microphone] Access granted, stream active', this._selectedDeviceLabel)
      this.setStatus('active')
      return true
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.warn('[Microphone] Permission denied by user')
        this.setStatus('permission-denied')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        console.warn('[Microphone] No microphone device found')
        this.setStatus('no-device')
      } else {
        console.error('[Microphone] Error requesting access:', error)
        this.setStatus('error')
      }
      return false
    }
  }

  async getStream(): Promise<MediaStream | null> {
    if (this._stream) return this._stream
    const success = await this.requestAccess()
    return success ? this._stream : null
  }

  stop() {
    if (this._stream) {
      this._stream.getTracks().forEach((track) => {
        track.stop()
        console.log('[Microphone] Stopped track:', track.kind)
      })
      this._stream = null
      this._selectedDeviceLabel = null
      this.setStatus('idle')
    }

    if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange)
    }
  }

  onStatusChange(callback: (status: MicrophoneStatus) => void): () => void {
    this._statusCallbacks.add(callback)
    return () => {
      this._statusCallbacks.delete(callback)
    }
  }
}

export const microphoneCapture = new MicrophoneCaptureImpl()
