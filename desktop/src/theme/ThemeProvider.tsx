import React, { useEffect } from 'react'
import { useThemeStore } from '../state/themeStore'
import { useWallpaper } from '../hooks/useWallpaper'
import { applyTheme } from './themeEngine'

/**
 * Simple provider that syncs the theme mode (dark/light) to CSS variables.
 * Future extensions can read wallpaper colors and update the variables here.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode } = useThemeStore()
  const { wallpaper } = useWallpaper()

  useEffect(() => {
    // Delegate all DOM‑side theme handling to the shared engine.
    applyTheme(mode, wallpaper)
  }, [mode, wallpaper])

  return <>{children}</>
}

