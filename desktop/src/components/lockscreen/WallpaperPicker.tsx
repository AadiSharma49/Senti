import React, { ChangeEvent } from 'react'
import { useWallpaper } from '../../hooks/useWallpaper'
import { motion } from 'framer-motion'

/**
 * Simple UI allowing the user to upload a custom wallpaper.
 * The image is stored as a data‑URL in localStorage via the useWallpaper hook.
 * A preview is shown and the background updates automatically.
 */
export default function WallpaperPicker() {
  const { wallpaper, setWallpaper } = useWallpaper()

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setWallpaper(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <motion.div
      className="mt-6 flex flex-col items-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <label className="text-sm text-secondary mb-1">Wallpaper</label>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          id="wallpaper-input"
        />
        <label
          htmlFor="wallpaper-input"
          className="px-3 py-1 bg-glass-hoverable rounded cursor-pointer text-sm text-primary"
        >
          Choose
        </label>
        {wallpaper && (
          <img
            src={wallpaper}
            alt="Wallpaper preview"
            className="w-12 h-8 object-cover rounded border border-accent-muted"
          />
        )}
      </div>
    </motion.div>
  )
}

