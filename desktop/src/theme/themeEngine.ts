/**
 * Theme engine – centralised logic for applying theme‑related CSS variables.
 * This module is deliberately lightweight and has no React dependencies so it
 * can be reused from any part of the codebase (e.g., Electron preload, tests).
 */

export function applyTheme(mode: 'light' | 'dark', wallpaper: string | null) {
  const root = document.documentElement
  // Toggle dark class for Tailwind's dark mode utilities
  root.classList.toggle('dark', mode === 'dark')
  // Primary accent colour – placeholder values that could be derived from the
  // wallpaper palette in future iterations.
  const accent = mode === 'dark' ? '#00d4ff' : '#ff4081'
  root.style.setProperty('--accent', accent)
  // Apply wallpaper background if provided
  if (wallpaper) {
    root.style.setProperty('--wallpaper', `url(${wallpaper})`)
  } else {
    root.style.removeProperty('--wallpaper')
  }
}

