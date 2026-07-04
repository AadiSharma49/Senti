import { useEffect, useRef } from 'react'

/**
 * StarField - a clean, slow-moving starfield rendered on a canvas.
 * Stars drift gently with depth-based parallax and twinkle. Subtle and
 * monochrome to match the dark theme. Pure ambience, no interaction.
 */
interface Star {
  x: number
  y: number
  z: number // depth 0.2..1 -> size, speed, brightness
  r: number
  phase: number
  twinkle: number
}

const STAR_COUNT = 170

export default function StarField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let stars: Star[] = []

    const makeStar = (seedTop = false): Star => ({
      x: Math.random() * w,
      y: seedTop ? -2 : Math.random() * h,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.1 + 0.35,
      phase: Math.random() * Math.PI * 2,
      twinkle: Math.random() * 0.6 + 0.4,
    })

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = Array.from({ length: STAR_COUNT }, () => makeStar())
    }

    let raf = 0
    let t = 0
    const frame = () => {
      t += 0.016
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        // Gentle downward drift; deeper (larger z) stars move faster
        s.y += s.z * 0.14
        if (s.y > h + 2) Object.assign(s, makeStar(true))
        const tw = 0.6 + Math.sin(t * 1.4 + s.phase) * 0.4 * s.twinkle
        const alpha = Math.min(1, s.z * tw) * 0.7
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(214,222,236,${alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    frame()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  )
}
