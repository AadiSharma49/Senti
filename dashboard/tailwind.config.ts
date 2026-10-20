import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sentinel brand — graphite + muted steel. Flat, no glow — matches the desktop app.
        bg: {
          DEFAULT: '#0b0c0f',
          soft: '#101114',
          panel: '#15161b',
        },
        accent: {
          DEFAULT: '#6b7a8f',
          glow: '#8a97a8',
          muted: 'rgba(107,122,143,0.25)',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s ease-out forwards',
        breathe: 'breathe 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
