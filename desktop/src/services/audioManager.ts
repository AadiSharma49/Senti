/**
 * Audio manager for Senti lock screen sound effects.
 * Manages preloaded Audio instances for instant playback.
 */

type SoundId = 'crash' | 'denied' | 'unlock' | 'panel-open' | 'panel-close' | 'save' | 'startup'

const SOUND_MAP: Record<string, string> = {
  'crash': '/assets/sounds/crash.mp3',
  'denied': '/assets/sounds/denied.mp3',
  'unlock': '/assets/sounds/unlock.mp3',
  'panel-open': '/assets/sounds/unlock.mp3',
  'panel-close': '/assets/sounds/denied.mp3',
  'save': '/assets/sounds/unlock.mp3',
  'startup': '/assets/sounds/unlock.mp3',
}

class AudioManager {
  private cache = new Map<string, HTMLAudioElement>()
  private initialized = false

  preload() {
    if (this.initialized) return
    this.initialized = true
    for (const [id, path] of Object.entries(SOUND_MAP)) {
      if (!this.cache.has(id)) {
        const audio = new Audio(path)
        audio.preload = 'auto'
        this.cache.set(id, audio)
        audio.load()
      }
    }
  }

  play(id: SoundId) {
    if (!this.cache.has(id)) {
      const path = SOUND_MAP[id]
      if (!path) return
      const audio = new Audio(path)
      audio.preload = 'auto'
      this.cache.set(id, audio)
    }
    const audio = this.cache.get(id)
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {
        // Autoplay may be blocked – ignore silently
      })
    }
  }

  stop(id: SoundId) {
    const audio = this.cache.get(id)
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }
}

export const audioManager = new AudioManager()