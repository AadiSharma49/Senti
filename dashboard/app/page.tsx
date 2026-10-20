import Link from 'next/link'
import { auth, currentUser } from '@clerk/nextjs/server'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import SentinelMark from '@/components/SentinelMark'
import { clerkEnabled } from '@/lib/auth'

const features = [
  {
    title: 'It lives on your machine',
    body: 'Not a browser tab you paste your problem into. Sentinel runs on the PC itself — so it can see this file, this system, this screen, and actually do something about it.',
  },
  {
    title: 'You hold the dial',
    body: 'An AI with access to your PC is frightening. An AI with exactly the access you gave it is not. Grant nothing, one folder, opening apps, or acting on its own while you are out — you set it, and it can never quietly widen it.',
  },
  {
    title: 'It remembers you',
    body: 'What you told it stays on your machine, not in someone else\'s database. Sentinel keeps a local memory of your habits and preferences, and gets more useful the more you use it.',
  },
  {
    title: 'Talk, and it acts',
    body: 'Say what you need — open an app, clean up temp files, check what is eating your RAM — and it does it, out loud, in a real human voice, in any language.',
  },
]

const steps = [
  { n: '01', title: 'Create your account', body: 'The dashboard is home base for your devices and what Sentinel is allowed to do.' },
  { n: '02', title: 'Install Sentinel', body: 'Download the desktop app for Windows and link it to your account with a one-time key.' },
  { n: '03', title: 'Say what you need', body: 'Open an app, ask about your system, get something done. No setup ritual, just talk.' },
  { n: '04', title: 'It is yours', body: 'Set exactly how much of your machine it can touch, and let it get to work.' },
]

// The vision, told honestly. Each item is labelled by where it really is, so
// "building in public" means what it says.
type Stage = 'Live' | 'Building' | 'Planned'
const vision: { title: string; body: string; stage: Stage }[] = [
  {
    title: 'Talk to it, and it answers',
    body: 'Ask anything. Sentinel replies out loud in a real human voice, in any language.',
    stage: 'Live',
  },
  {
    title: 'It runs your machine',
    body: 'Open apps, clean up temp files, check what is using memory — by voice. An assistant that does things, not just talks about them.',
    stage: 'Live',
  },
  {
    title: 'It remembers you',
    body: 'Sentinel keeps a local, on-device memory of what you tell it, so it stops asking the same things twice.',
    stage: 'Live',
  },
  {
    title: 'Any AI model you want',
    body: 'The brain is yours to choose — Llama, Grok, GPT, Gemini. Pick the mind that fits how you work.',
    stage: 'Building',
  },
  {
    title: 'It watches, and tells you first',
    body: 'When your system is under load or something is misbehaving, Sentinel notices and offers to help — before you ask.',
    stage: 'Building',
  },
  {
    title: 'Reach it from anywhere',
    body: 'Check and control your PC from your phone. And when something needs a decision while you are away, Sentinel reaches out first.',
    stage: 'Building',
  },
  {
    title: 'Private by default',
    body: 'Speech recognition runs on-device. Nothing leaves your machine except the words themselves, sent only to answer you.',
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
          <SentinelMark size={96} />
        </div>

        {name && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-accent">
            Welcome back, {name}
          </div>
        )}

        <h1 className="max-w-3xl text-5xl font-bold leading-tight text-white md:text-6xl">
          The AI that actually <span className="text-accent text-glow">lives on your PC.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/60">
          Most AI lives in a browser tab, waiting for you to paste your problem in. Sentinel lives
          on the machine — it watches, it acts, and it only ever has the access you give it.
        </p>

        <div className="mt-10">
          <Cta />
        </div>

        <div className="mt-8 text-xs text-white/35">On-device speech recognition • You set the access dial</div>
      </section>

      {/* The argument — access on a dial */}
      <section className="border-y border-white/5 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">The question nobody is answering</div>
          <h2 className="mt-4 text-2xl font-bold leading-snug text-white md:text-4xl">
            When an AI can act on your machine, how much should it be allowed to do?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-white/60">
            Agents are getting powerful enough to delete files, spend money, and run commands —
            and most of them ship with either everything or nothing. Sentinel starts from
            <span className="text-white"> a dial, not a switch:</span> nothing, one folder, opening
            apps, or acting on its own while you are out. You set it, and it can never quietly widen it.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-14 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">Why Sentinel is different</div>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Not another chat window</h2>
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
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Four steps to make it yours</h2>
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
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">From your key to your co-pilot</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            It starts as the assistant that knows it is you. It becomes the one that runs your
            machine, learns you, and reaches you anywhere — always behind the access dial you set.
            Built in public, so here is exactly where each piece stands. No hype.
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
          One thing we will not do: silently capture your screen or your life. Sentinel only acts
          on what you ask or what you have explicitly allowed, and nothing leaves your machine unless you choose to sync it.
        </p>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="glass-strong relative overflow-hidden rounded-[36px] p-10 text-center md:p-16">
          <div className="relative">
            <div className="mb-6 flex justify-center">
              <SentinelMark size={56} />
            </div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              {signedIn ? 'Your machine is waiting.' : 'Make your computer yours.'}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              {signedIn
                ? 'Install Sentinel on this computer, link it to your account, and start talking.'
                : 'Create a free account, install Sentinel, and speak. That is the whole setup.'}
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
