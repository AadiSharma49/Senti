type SoundKey =
  | 'startup'
  | 'unlock'
  | 'denied'
  | 'crash'
  | 'save'
  | 'panel-open'
  | 'panel-close'

const SOUND_PATH = '/assets/sounds'

const SOUND_FILES: Record<SoundKey, string> = {
  'startup': 'startup.mp3',
  'unlock': 'unlock.mp3',
  'denied': 'denied.mp3',
  'crash': 'crash.mp3',
  'save': 'save.mp3',
  'panel-open': 'panel-open.mp3',
  'panel-close': 'panel-close.mp3',
}

class AudioManager {
  private map: Map<SoundKey, HTMLAudioElement>
  private volume = 0.85
  private initialized = false

  constructor() {
    this.map = new Map()
  }

  preload() {
    if (this.initialized) return
    ;(Object.keys(SOUND_FILES) as SoundKey[]).forEach((k) => {
      const filename = SOUND_FILES[k]
      const path = `${SOUND_PATH}/${filename}`
      const a = new Audio(path)
      a.preload = 'auto'
      a.volume = this.volume
      a.loop = false
      this.map.set(k, a)
    })
    this.initialized = true
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    for (const a of this.map.values()) a.volume = this.volume
  }

  play(key: SoundKey) {
    try {
      if (!this.initialized) this.preload()
      const a = this.map.get(key)
      if (!a) return
      try {
        a.pause()
        a.currentTime = 0
      } catch {}
      console.log('[AUDIO] playing ' + key)
      const p = a.play()
      if (p && typeof (p as any).catch === 'function') {
        (p as any).catch((err: any) => {
          console.log('[AUDIO] ' + key + ' play rejected: ' + (err?.message || 'unknown'))
        })
      }
      return a
    } catch {
      // ignore
    }
  }

  stop(key?: SoundKey) {
    if (!this.initialized) return
    if (key) {
      const a = this.map.get(key)
      if (a) {
        try { a.pause(); a.currentTime = 0 } catch {}
      }
    } else {
      for (const a of this.map.values()) {
        try { a.pause(); a.currentTime = 0 } catch {}
      }
    }
  }
}

export const audioManager = new AudioManager()
export type { SoundKey }