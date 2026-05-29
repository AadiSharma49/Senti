import { useState, useEffect } from 'react'

/**
 * Simple hook to manage a user‑selected wallpaper.
 * The image is stored as a data‑URL in localStorage under the key "senti:wallpaper".
 * Returns the current wallpaper URL (or empty string) and a setter.
 */
export function useWallpaper() {
  const [wallpaper, setWallpaper] = useState<string>('')

  useEffect(() => {
    const stored = localStorage.getItem('senti:wallpaper')
    if (stored) setWallpaper(stored)
  }, [])

  const update = (dataUrl: string) => {
    localStorage.setItem('senti:wallpaper', dataUrl)
    setWallpaper(dataUrl)
    // Simple average‑color extraction for accent (placeholder implementation)
    const img = new Image()
    img.src = dataUrl
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, img.width, img.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      let r = 0,
        g = 0,
        b = 0,
        count = 0
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
        count++
      }
      r = Math.round(r / count)
      g = Math.round(g / count)
      b = Math.round(b / count)
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
      document.documentElement.style.setProperty('--accent', hex)
    }
  }

  return { wallpaper, setWallpaper: update }
}

