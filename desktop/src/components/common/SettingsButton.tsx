import React from 'react'
import { motion } from 'framer-motion'
import { useUiStore } from '../../state/uiStore'

/**
 * Simple settings button displayed on the lock-screen.
 * Currently it only logs a message - the full settings UI will be added in later phases.
 */
export default function SettingsButton() {
  const open = useUiStore((s) => s.openSettings)
  const handleClick = () => {
    open()
  }

  return (
    <motion.button
      className="absolute top-4 right-4 p-2 rounded-full glass-hoverable transition-transform"
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      aria-label="Open Settings"
      title="Settings"
    >
      {/* Gear icon (simple SVG) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 text-primary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l.3 1.02a1.5 1.5 0 001.13.985l1.09.158c.96.14 1.34 1.31.647 1.95l-.79.73a1.5 1.5 0 00-.44 1.34l.188 1.083c.166.96-.755 1.688-1.64 1.31l-1.02-.42a1.5 1.5 0 00-1.4 0l-1.02.42c-.885.378-1.806-.35-1.64-1.31l.188-1.083a1.5 1.5 0 00-.44-1.34l-.79-.73c-.693-.64-.313-1.81.647-1.95l1.09-.158a1.5 1.5 0 001.13-.985l.3-1.02z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3"
        />
      </svg>
    </motion.button>
  )
}

