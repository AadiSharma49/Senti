import SentinelMark from './SentinelMark'

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-white/40 md:flex-row">
        <div className="flex items-center gap-2">
          <SentinelMark size={22} />
          <span>Sentinel</span>
        </div>
        <div>© {new Date().getFullYear()} Sentinel — the AI that lives on your PC.</div>
        <div className="flex gap-6">
          <a href="/#features" className="transition hover:text-white/70">Features</a>
          <a href="/#download" className="transition hover:text-white/70">Download</a>
          <a href="/login" className="transition hover:text-white/70">Sign in</a>
        </div>
      </div>
    </footer>
  )
}
