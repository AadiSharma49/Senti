/**
 * Local TTS via Piper — zero cloud calls for voice.
 *
 * Piper runs a local HTTP server (default port 5000). We POST text, get
 * back WAV audio. No ElevenLabs, no cloud, no data leaves the machine.
 */

const PIPER_HOST = 'http://localhost:5000'

let piperRunning = false

/**
 * Check if Piper is running.
 */
export async function getPiperStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${PIPER_HOST}/api/voices`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Start Piper TTS server if not already running.
 * Piper.exe path is configurable — defaults to the bundled binary.
 */
export async function startPiper(): Promise<boolean> {
  if (piperRunning) return true
  const alreadyRunning = await getPiperStatus()
  if (alreadyRunning) {
    piperRunning = true
    return true
  }

  try {
    // Look for Piper in common locations.
    const possiblePaths = [
      `${process.resourcesPath || ''}/piper/piper.exe`,
      'E:/Senti/piper/piper.exe',
      './piper/piper.exe',
    ]
    const piperPath = possiblePaths.find((p) => {
      try {
        // @ts-ignore
        return require('fs').existsSync(p)
      } catch {
        return false
      }
    })

    if (!piperPath) {
      console.warn('[localTTS] Piper binary not found — TTS will use browser synthesis')
      return false
    }

    // @ts-ignore
    const { spawn } = require('child_process')
    // @ts-ignore
    const path = require('path')
    // @ts-ignore
    const os = require('os')

    const modelDir = path.dirname(piperPath)
    const voicesDir = path.join(modelDir, 'voices')

    const proc = spawn(piperPath, [
      '--http',
      '--port', '5000',
      '--voices-dir', voicesDir,
    ], {
      stdio: 'ignore',
      detached: true,
    })

    proc.unref()

    // Wait for Piper to start.
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500))
      if (await getPiperStatus()) {
        piperRunning = true
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Synthesize speech locally via Piper. Returns a data URI of the WAV audio,
 * or null if Piper isn't available.
 */
export async function localTTS(text: string, voice: string = 'en_US-lessac-medium'): Promise<string | null> {
  if (!text.trim()) return null

  // Ensure Piper is running.
  const ok = await startPiper()
  if (!ok) return null

  try {
    const res = await fetch(`${PIPER_HOST}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) return null
    const blob = await res.blob()
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:audio/wav;base64,${base64}`
  } catch {
    return null
  }
}

/**
 * Get list of available Piper voices.
 */
export async function getLocalVoices(): Promise<string[]> {
  try {
    const res = await fetch(`${PIPER_HOST}/api/voices`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.voices) ? data.voices : []
  } catch {
    return []
  }
}
