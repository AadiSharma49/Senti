import Link from 'next/link'
import { auth, currentUser } from '@clerk/nextjs/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import SentiMark from '@/components/SentiMark'
import { clerkEnabled } from '@/lib/auth'

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
    title: 'An assistant that talks back',
    body: 'Once you are in, just talk to Senti. It answers out loud in a real human voice, in any language, and it knows who it is speaking to.',
  },
  {
    title: 'One account, every device',
    body: 'Enroll once, sign in anywhere. Manage your voice and security policy from the dashboard — your devices just follow it.',
  },
]

const steps = [
  { n: '01', title: 'Create your account', body: 'The dashboard is home base for your devices and voice profile.' },
  { n: '02', title: 'Install Senti', body: 'Download the desktop app for Windows and link it to your account.' },
  { n: '03', title: 'Enroll your voice', body: 'Speak naturally a few times — any words. Your voiceprint is learned on-device.' },
  { n: '04', title: 'Unlock by speaking', body: 'Lock down, walk up, and talk to your computer. Your voice is the key.' },
]

// The vision, told honestly. Each item is labelled by where it really is, so
// "building in public" means what it says.
type Stage = 'Live' | 'Building' | 'Planned'
const vision: { title: string; body: string; stage: Stage }[] = [
  {
    title: 'A voice that is only yours',
    body: 'Senti verifies who is speaking, not what was said. It listens for you and no one else — the check runs on your device.',
    stage: 'Live',
  },
  {
    title: 'Talk to it, and it answers',
    body: 'Ask anything. Senti replies out loud in a real human voice, in any language, and knows who it is talking to.',
    stage: 'Live',
  },
  {
    title: 'Any AI model you want',
    body: 'The brain is yours to choose — Llama, Grok, GPT, Gemini. Pick the mind that fits how you work.',
    stage: 'Building',
  },
  {
    title: 'It runs your machine',
    body: 'Open apps, run tasks, control your editor — by voice. An assistant that does things, not just talks about them.',
    stage: 'Planned',
  },
  {
    title: 'It remembers you',
    body: 'Senti learns your context and your taste, and gets more useful the more you use it. A weekly brief of what mattered.',
    stage: 'Planned',
  },
  {
    title: 'Reach it from anywhere',
    body: 'Lock, check, and control your PC from your phone. And when something needs you, Senti reaches out first.',
    stage: 'Planned',
  },
  {
    title: 'The real lock screen',
    body: 'A Windows credential provider so Senti becomes the login gate itself — the version nothing walks past.',
    stage: 'Planned',
  },
  {
    title: 'Private by default',
    body: 'Your voice is verified on-device and never uploaded. Voiceprints are encrypted; your keys stay on your server.',
    stage: 'Live',
  },
]

const stageStyle: Record<Stage, string> = {
  Live: 'border-green-400/30 bg-green-500/10 text-green-300',
  Building: 'border-accent/30 bg-accent/10 text-accent',
  Planned: 'border-white/15 bg-white/5 text-white/50',
}

export default async function Home() {
  const signedIn = clerkEnabled ? !!auth().userId : false
  const user = signedIn ? await currentUser() : null
  const name = user?.firstName || null

  /** Signed-in visitors have already "signed up" — send them where they're going. */
  const Cta = () =>
    signedIn ? (
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-black transition hover:bg-accent-glow"
        >
          Open your dashboard
        </Link>
        <Link href="/dashboard/download" className="text-xs text-white/45 transition hover:text-white">
          or download the desktop app
        </Link>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-black transition hover:bg-accent-glow"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Sign in
          </Link>
        </div>
        <div className="text-xs text-white/35">Free to start. No credit card.</div>
      </div>
    )

  return (
    <div className="bg-ambient">
      <SiteHeader />

      {/* Hero */}
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-40 text-center">
        <div className="mb-8">
          <SentiMark size={96} />
        </div>

        {name && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-accent">
            Welcome back, {name}
          </div>
        )}

        <h1 className="max-w-3xl text-5xl font-bold leading-tight text-white md:text-6xl">
          Run your computer <span className="text-accent text-glow">with your voice.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/60">
          Senti is an AI layer for your PC. It knows your voice — so it unlocks for you and no
          one else — and it is becoming the assistant that runs your machine, remembers you, and
          answers from anywhere. Your voice verification runs entirely on your own device.
        </p>

        <div className="mt-10">
          <Cta />
        </div>

        <div className="mt-8 text-xs text-white/35">On-device • No voice data ever leaves your machine</div>
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

      {/* Vision / roadmap */}
      <section id="vision" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-4 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">Where it is going</div>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">An AI layer for your computer</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            Senti starts as the lock that knows your voice. It is becoming the assistant that runs
            your machine, remembers you, and reaches you anywhere. Built in public — here is exactly
            where each piece stands, honestly.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {vision.map((v) => (
            <div key={v.title} className="glass flex flex-col rounded-3xl p-5 transition hover:border-accent/30">
              <span
                className={`mb-3 inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] ${stageStyle[v.stage]}`}
              >
                {v.stage}
              </span>
              <h3 className="text-base font-semibold text-white">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{v.body}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-white/35">
          One thing we will not do: silently capture your screen or your life. Senti records only
          on a security event you can see, and nothing leaves your machine unless you choose to sync it.
        </p>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="glass-strong relative overflow-hidden rounded-[36px] p-10 text-center md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,212,255,0.15),transparent_60%)]" />
          <div className="relative">
            <div className="mb-6 flex justify-center">
              <SentiMark size={56} />
            </div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              {signedIn ? 'Your machine is waiting.' : 'Unlock with your voice.'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              {signedIn
                ? 'Install Senti on this computer, link it to your account, and enroll your voice.'
                : 'Create an account, install Senti, and speak. That is the whole setup.'}
            </p>
            <div className="mt-8 flex justify-center">
              <Cta />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
