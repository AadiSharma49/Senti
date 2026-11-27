/**
 * AudioCapture - Reusable microphone capture service.
 *
 * Provides raw PCM audio frames and RMS levels for downstream
 * authentication engines (Voice, Clap, Wake Word).
 *
 * Uses only Web Audio API:
 *   MediaDevices.getUserMedia -> AudioContext -> ScriptProcessorNode
 *
 * Frames are CONTIGUOUS: every microphone sample is delivered exactly
 * once, in order. Subscribers can concatenate frame samples to rebuild
 * a gapless recording (required for voice enrollment/verification).
 *
 * ScriptProcessorNode is deprecated in favor of AudioWorklet, but it is
 * fully supported in Chromium, needs no separate module file, and works
 * under both dev-server and file:// production loads. Migrating to
 * AudioWorklet is a contained future change inside this service only.
 *
 * No authentication logic. No backend. No Electron IPC. No AI.
 */

import type {
  AudioCaptureState,
  AudioLevel,
  AudioFrame,
  AudioCaptureConfig,
  AudioFrameCallback,
  AudioStatusCallback,
  MicrophoneStatus,
} from '../types/audio'
import { buildInventory, resolveMic, type MicInput, type MicInventory, type StoredMic } from './micChoice'

const MIC_ID_KEY = 'senti:micDeviceId'
const MIC_LABEL_KEY = 'senti:micLabel'
const MIC_CONFIRMED_KEY = 'senti:micConfirmed'
const MIC_PROMPTED_KEY = 'senti:micPrompted'

function readKey(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeKey(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // storage unavailable — we'll just use the default
  }
}

/** Open one specific input ('' = whatever Windows calls the default). */
function openMic(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
  })
}

const DEFAULT_CONFIG: Required<AudioCaptureConfig> = {
  sampleRate: 44100,
  fftSize: 2048,        // processor buffer size: 2048 samples ≈ 46ms per frame at 44.1kHz
  frameDuration: 0.05,  // nominal frame duration (informational)
  maxBufferFrames: 40,  // 2 seconds at ~50ms
}

export class AudioCapture {
  private config: Required<AudioCaptureConfig>
  private state: AudioCaptureState = 'idle'
  private error: string | null = null
  private deviceLabel: string | null = null
  /** Label of the chosen mic we couldn't open, while on the Windows default instead. */
  private fallbackFrom: string | null = null

  private stream: MediaStream | null = null
  private systemStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null

  private frameCallbacks: Set<AudioFrameCallback> = new Set()
  private statusCallbacks: Set<AudioStatusCallback> = new Set()
  private deviceLostCallbacks: Set<() => void> = new Set()

  constructor(config?: AudioCaptureConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** The microphone the user picked, or '' to follow the Windows default. */
  static preferredDeviceId(): string {
    return readKey(MIC_ID_KEY)
  }

  /**
   * The saved choice. `confirmed` is false until the user has actually been
   * asked — '' with confirmed=false means "never asked", '' with
   * confirmed=true means "deliberately follow Windows".
   */
  static savedMic(): StoredMic & { confirmed: boolean } {
    return {
      id: readKey(MIC_ID_KEY),
      label: readKey(MIC_LABEL_KEY),
      confirmed: readKey(MIC_CONFIRMED_KEY) === '1',
    }
  }

  /**
   * Record the user's explicit choice. The label is kept so we can name the
   * device when it's unplugged, and re-find it if Chromium re-issues its id.
   */
  static chooseMic(id: string, label: string): void {
    writeKey(MIC_ID_KEY, id)
    writeKey(MIC_LABEL_KEY, id ? label : '')
    writeKey(MIC_CONFIRMED_KEY, '1')
  }

  /** Whether an upgraded install has already been asked once. */
  static micPrompted(): boolean {
    return readKey(MIC_PROMPTED_KEY) === '1'
  }

  static markMicPrompted(): void {
    writeKey(MIC_PROMPTED_KEY, '1')
  }

  /** What's plugged in, for the picker. Labels need permission to have been given. */
  static async inventory(): Promise<MicInventory> {
    try {
      return buildInventory(await navigator.mediaDevices.enumerateDevices())
    } catch {
      return { inputs: [], windowsDefault: null }
    }
  }

  /** Real input devices only (no Chromium "default"/"communications" aliases). */
  static async listInputs(): Promise<MicInput[]> {
    return (await AudioCapture.inventory()).inputs
  }

  // --- Public API ---------------------------------------------------

  /** Request microphone permission without starting capture */
  async requestPermission(): Promise<boolean> {
    try {
      this.setState('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the test stream immediately - we only needed permission
      stream.getTracks().forEach((t) => t.stop())
      this.setState('idle')
      return true
    } catch (err) {
      this.handleError(err)
      return false
    }
  }

  /**
   * Start capturing audio from the microphone.
   *
   * By default opens the user's saved choice, falling back to the Windows
   * default ONLY when that device isn't connected — and recording that it did
   * (see `getStatus().fallbackFrom`), so the UI can say so instead of
   * listening to the wrong mic in silence.
   *
   * `{ deviceId }` opens exactly that device with no fallback ('' = Windows
   * default). The mic test in the picker uses this: a test that quietly ran
   * on a different microphone would prove nothing.
   */
  async start(opts?: { deviceId?: string }): Promise<void> {
    if (this.state === 'active') return

    try {
      this.setState('requesting')
      this.fallbackFrom = null

      if (opts?.deviceId !== undefined) {
        this.stream = await openMic(opts.deviceId)
      } else {
        this.stream = await this.openSavedMic()
      }
      const track = this.stream.getAudioTracks()[0]
      this.deviceLabel = track?.label || null
      // Unplugging the device ends the track — and without this, capture
      // just goes silent forever. Tell whoever owns the capture so it can
      // reopen on whatever is still connected.
      if (track) {
        track.onended = () => {
          if (this.stream?.getAudioTracks()[0] !== track) return
          this.deviceLostCallbacks.forEach((cb) => {
            try {
              cb()
            } catch {
              // a broken subscriber must not block the others
            }
          })
        }
      }

      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(this.config.fftSize, 1, 1)
      this.processor.onaudioprocess = (event) => this.handleAudioProcess(event)

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.setState('active')
    } catch (err) {
      this.handleError(err)
      throw err
    }
  }

  /** Capture system audio (speaker output) via getDisplayMedia loopback.
   *  Returns the MediaStream so the caller can mix it with mic audio. */
  async captureSystemAudio(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true,
      })
      return stream
    } catch {
      return null
    }
  }

  /** Stop capturing audio and release resources */
  stop(): void {
    if (this.systemStream) {
      this.systemStream.getTracks().forEach((t) => t.stop())
      this.systemStream = null
    }

    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
      this.processor = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        t.onended = null
        t.stop()
      })
      this.stream = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    this.deviceLabel = null
    this.fallbackFrom = null
    this.error = null
    this.setState('idle')
  }

  /** Check if microphone is currently recording */
  isRecording(): boolean {
    return this.state === 'active'
  }

  /** Get current RMS audio level (cached from last frame) */
  getCurrentLevel(): AudioLevel {
    return this.lastLevel
  }

  /** Get current microphone status */
  getStatus(): MicrophoneStatus {
    return {
      state: this.state,
      error: this.error,
      deviceLabel: this.deviceLabel,
      sampleRate: this.audioContext?.sampleRate ?? null,
      fallbackFrom: this.fallbackFrom,
    }
  }

  /** Called when the open microphone disappears (unplugged, disabled). */
  onDeviceLost(callback: () => void): () => void {
    this.deviceLostCallbacks.add(callback)
    return () => {
      this.deviceLostCallbacks.delete(callback)
    }
  }

  /** Subscribe to contiguous audio frames (one every ~46ms) */
  subscribe(callback: AudioFrameCallback): () => void {
    this.frameCallbacks.add(callback)
    return () => {
      this.frameCallbacks.delete(callback)
    }
  }

  /** Subscribe to status changes */
  onStatusChange(callback: AudioStatusCallback): () => void {
    this.statusCallbacks.add(callback)
    return () => {
      this.statusCallbacks.delete(callback)
    }
  }

  /** Release all resources and clean up */
  dispose(): void {
    this.stop()
    this.frameCallbacks.clear()
    this.statusCallbacks.clear()
    this.deviceLostCallbacks.clear()
  }

  // --- Private ------------------------------------------------------

  /**
   * Open the saved choice. Only the Windows default is ever substituted, and
   * only when the chosen device can't be opened; `fallbackFrom` records it.
   */
  private async openSavedMic(): Promise<MediaStream> {
    const stored = AudioCapture.savedMic()
    let res = resolveMic(stored, await AudioCapture.inventory())
    if (res.kind === 'default') return openMic('')

    if (res.kind === 'relabeled') {
      writeKey(MIC_ID_KEY, res.id)
      return openMic(res.id)
    }

    try {
      // 'missing' is still tried once: before permission is granted the
      // device list can come back blind, so "not listed" isn't proof.
      return await openMic(stored.id)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') throw err
    }

    const fallback = await openMic('')
    // Permission exists now, so the list has real labels. If the device is
    // here under a new id after all, switch to it rather than settle.
    res = resolveMic(stored, await AudioCapture.inventory())
    if (res.kind === 'relabeled') {
      try {
        const exact = await openMic(res.id)
        writeKey(MIC_ID_KEY, res.id)
        fallback.getTracks().forEach((t) => t.stop())
        return exact
      } catch {
        // stay on the fallback below
      }
    }
    this.fallbackFrom = stored.label || 'your chosen microphone'
    return fallback
  }

  private lastLevel: AudioLevel = { rms: 0, peak: 0, clipped: false }

  private setState(newState: AudioCaptureState): void {
    this.state = newState
    this.notifyStatus()
  }

  private handleError(err: unknown): void {
    const message =
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : err instanceof Error
        ? err.message
        : 'Unknown microphone error'
    this.error = message
    this.setState('error')
  }

  private notifyStatus(): void {
    const status = this.getStatus()
    this.statusCallbacks.forEach((cb) => cb(status))
  }

  private computeLevel(data: Float32Array): AudioLevel {
    let sumSquares = 0
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const s = Math.abs(data[i])
      sumSquares += s * s
      if (s > peak) peak = s
    }
    const rms = Math.sqrt(sumSquares / data.length)
    return { rms, peak, clipped: peak >= 1.0 }
  }

  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (this.state !== 'active') return

    const input = event.inputBuffer.getChannelData(0)
    // Copy: the underlying buffer is reused by the audio engine
    const samples = new Float32Array(input)
    const sampleRate = this.audioContext?.sampleRate ?? this.config.sampleRate

    const frame: AudioFrame = {
      samples,
      sampleRate,
      channels: 1,
      timestamp: performance.now(),
      duration: samples.length / sampleRate,
    }

    this.lastLevel = this.computeLevel(samples)

    this.frameCallbacks.forEach((cb) => {
      try {
        cb(frame, this.lastLevel)
      } catch {
        // Silently ignore subscriber errors
      }
    })
  }
}

/**
 * App-wide shared microphone instance. Production code (voice unlock,
 * enrollment, future clap engine) must use this single instance and
 * subscribe to it — never create additional captures. Debug panels may
 * create their own isolated instances.
 */
export const audioCapture = new AudioCapture()
