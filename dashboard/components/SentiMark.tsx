/** The Senti "AI core" orb mark — echoes the desktop visualizer. */
export default function SentiMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-full border border-accent/40" />
      <span className="absolute rounded-full border border-accent/30" style={{ inset: size * 0.16 }} />
      <span
        className="absolute rounded-full bg-accent animate-breathe"
        style={{ inset: size * 0.34, boxShadow: '0 0 16px rgba(0,212,255,0.8)' }}
      />
    </span>
  )
}
