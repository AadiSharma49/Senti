import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import SentiMark from '@/components/SentiMark'

const features = [
  {
    title: 'Voice unlock',
    body: 'Walk up and speak your passphrase. Senti recognizes your voice — not just the words — and unlocks instantly.',
    icon: '🎙️',
  },
  {
    title: 'Fully on-device',
    body: 'Your voiceprint never leaves your machine. Verification runs locally with a neural network — no cloud, no Python, no internet needed.',
    icon: '🔒',
  },
  {
    title: 'PIN fallback',
    body: 'Voice is primary; a PIN is always there as the emergency fallback. Three failed voice attempts hand off to PIN automatically.',
    icon: '🔢',
  },
  {
    title: 'Hardened lock',
    body: 'Escape hotkeys are blocked, the window resists close, and the app relaunches at login. A determined lock, not a flimsy overlay.',
    icon: '🛡️',
  },
  {
    title: 'Sync across devices',
    body: 'Enroll once, sign in anywhere. Your voice profile follows your account to every computer you install Senti on.',
    icon: '☁️',
  },
  {
    title: 'Security timeline',
    body: 'See every unlock, every failed attempt, every device — all from your dashboard, wherever you are.',
    icon: '📊',
  },
]

const steps = [
  { n: '01', title: 'Create your account', body: 'Sign up on the dashboard — this is the home base for your devices and voice profile.' },
  { n: '02', title: 'Download & install Senti', body: 'Grab the desktop app for Windows and sign in with the same account.' },
  { n: '03', title: 'Enroll your voice', body: 'Say your passphrase a few times. Senti learns your unique voiceprint on-device.' },
  { n: '04', title: 'Unlock by speaking', body: 'From now on, your voice is the key. Lock down, walk up, and talk to your computer.' },
]

export default function Home() {
  return (
    <div className="bg-ambient">
      <SiteHeader />

      {/* Hero */}
      <section className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-40 text-center">
        <div className="mb-8 animate-fade-up">
          <SentiMark size={96} />
        </div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-accent">
          AI-powered desktop security
        </div>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight text-white md:text-6xl">
          Your voice is <span className="text-accent text-glow">the key.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/60">
          Senti locks your computer and unlocks it when it hears you. Speaker verification
          runs entirely on your device — private, fast, and yours alone.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/#download"
            className="rounded-full bg-accent px-8 py-4 text-sm font-semibold text-black transition hover:bg-accent-glow accent-ring"
          >
            Download for Windows
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-white/15 px-8 py-4 text-sm font-semibold text-white/90 transition hover:bg-white/5"
          >
            Create free account
          </Link>
        </div>
        <div className="mt-6 text-xs text-white/35">On-device • No voice data leaves your machine</div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-14 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">Why Senti</div>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Security that knows you</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-3xl p-6 transition hover:border-accent/30">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-14 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">How it works</div>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Four steps to voice unlock</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="glass rounded-3xl p-6">
              <div className="font-mono text-2xl text-accent">{s.n}</div>
              <h3 className="mt-3 text-base font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Download */}
      <section id="download" className="mx-auto max-w-6xl px-6 py-20">
        <div className="glass-strong relative overflow-hidden rounded-[36px] p-10 text-center md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,212,255,0.15),transparent_60%)]" />
          <div className="relative">
            <div className="mb-6 flex justify-center">
              <SentiMark size={64} />
            </div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">Download Senti</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              Free while in early access. Windows 10 &amp; 11. Sign in with your Senti account
              to sync your voice profile.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#"
                className="rounded-full bg-accent px-8 py-4 text-sm font-semibold text-black transition hover:bg-accent-glow accent-ring"
              >
                ⬇ Download for Windows
              </a>
              <span className="text-xs text-white/40">v0.1.0 • ~120 MB</span>
            </div>
            <div className="mt-6 text-xs text-white/35">
              macOS &amp; Linux coming soon
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
