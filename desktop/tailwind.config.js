/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          glow: 'var(--accent-glow)',
          muted: 'var(--accent-muted)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Syne', 'Inter', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
        spacegrotesk: ['"Space Grotesk"', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'spin-reverse': 'spin-reverse 30s linear infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'ring-orbit': 'ring-orbit 8s linear infinite',
        'scanline': 'scanline 10s linear infinite',
        'grid-drift': 'grid-drift 60s linear infinite',
        'fade-in-up': 'fade-in-up 0.8s ease-out forwards',
        'fade-in': 'fade-in 1s ease-out forwards',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        'spin-reverse': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        },
        'ring-orbit': {
          '0%': { transform: 'rotate(0deg) translateX(80px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(80px) rotate(-360deg)' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'grid-drift': {
          '0%': { transform: 'translate(0, 0)' },
          '100%': { transform: 'translate(40px, 40px)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px var(--accent-glow), 0 0 40px var(--accent-glow)' },
          '50%': { boxShadow: '0 0 30px var(--accent-glow), 0 0 60px var(--accent-glow), 0 0 80px var(--accent-glow)' },
        },
      },
    },
  },
  plugins: [],
}
