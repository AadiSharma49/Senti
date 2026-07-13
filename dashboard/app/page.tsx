import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import SentiMark from '@/components/SentiMark'
import WaitlistForm from '@/components/WaitlistForm'

const features = [
  {
    title: 'Voice unlock',
    body: 'Walk up and say anything at all. There is no passphrase to remember — Senti recognizes your voice itself, and unlocks instantly.',
  },
  {
    title: 'Fully on-device',
    body: 'Your voiceprint never leaves your machine. A neural network verifies you locally — no cloud, no servers, no internet required.',
  },
  {
    title: 'PIN fallback',
    body: 'Voice is primary; a PIN is always there as the emergency fallback. Three failed voice attempts hand off to PIN automatically.',
  },
  {
    title: 'One account, every device',
    body: 'Enroll once, sign in anywhere. Manage your voice and security policy from the dashboard — your devices just follow it.',
  },
]

const steps = [
  { n: '01', title: 'Create your account', body: 'The dashboard is home base for your devices and voice profile.' },
  { n: '02', title: 'Install Senti', body: 'Download the desktop app for Windows and sign in.' },
  { n: '03', title: 'Enroll your voice', body: 'Speak naturally a few times — any words. Your voiceprint is learned on-device.' },
  { n: '04', title: 'Unlock by speaking', body: 'Lock down, walk up, and talk to your computer. Your voice is the key.' },
]

export default function Home() {
  return (
    <div className="bg-ambient">
      <SiteHeader />

      {/* Hero + waitlist */}
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-40 text-center">
        <div className="mb-8">
          <SentiMark size={96} />
        </div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-accent">
          Early access · Building in public
        </div>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight text-white md:text-6xl">
          Your voice is <span className="text-accent text-glow">the key.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/60">
          Senti locks your computer and unlocks it when it hears you. Speaker verification
          runs entirely on your device — private, fast, and yours alone.
        </p>
        <div className="mt-10 w-full">
          <WaitlistForm source="hero" />
        </div>
        <div className="mt-6 text-xs text-white/35">On-device • No voice data ever leaves your machine</div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-14 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">Why Senti</div>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Security that knows you</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-3xl p-6 transition hover:border-accent/30">
              <h3 className="text-lg font-semibold text-white">{f.title}</h3>
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

      {/* Closing waitlist */}
      <section id="waitlist" className="mx-auto max-w-6xl px-6 py-20">
        <div className="glass-strong relative overflow-hidden rounded-[36px] p-10 text-center md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,212,255,0.15),transparent_60%)]" />
          <div className="relative">
            <div className="mb-6 flex justify-center">
              <SentiMark size={56} />
            </div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">Be the first to unlock with your voice</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              Senti is in early access. Join the waitlist and we&apos;ll let you in as soon as it&apos;s ready.
            </p>
            <div className="mt-8">
              <WaitlistForm source="footer" />
            </div>
            <div className="mt-6 text-xs text-white/35">
              Already have access?{' '}
              <Link href="/login" className="text-accent hover:underline">Sign in</Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
