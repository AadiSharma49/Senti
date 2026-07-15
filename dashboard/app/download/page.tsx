import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import SentiMark from '@/components/SentiMark'

export const dynamic = 'force-dynamic'

/**
 * PUBLIC download page. Anyone can reach this and download the installer
 * without an account — it lives outside /dashboard, so the auth middleware
 * doesn't gate it. An account is only needed later, to link the device.
 */
const RELEASE_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL ||
  'https://github.com/AadiSharma49/Senti/releases/download/Software/Senti-Setup.exe'

const RELEASES_PAGE = 'https://github.com/AadiSharma49/Senti/releases'

const steps = [
  { n: '01', t: 'Install and launch', b: 'Run the installer. Senti opens straight into first-time setup. Allow the microphone when Windows asks.' },
  { n: '02', t: 'Make a free account', b: 'Sign in on this site, open Devices, and click Link a device to get a pairing token.' },
  { n: '03', t: 'Paste the token', b: 'Setup asks for it on the first screen — it links this PC to your account.' },
  { n: '04', t: 'Enroll your voice', b: 'Read five short lines. Senti learns your voice, not the words — so afterwards you can say anything.' },
]

export default function PublicDownloadPage() {
  return (
    <div className="bg-ambient min-h-screen">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-36 text-center">
        <div className="mb-6 flex justify-center">
          <SentiMark size={72} />
        </div>
        <h1 className="text-4xl font-bold text-white md:text-5xl">Download Senti</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/60">
          Install it, link it to a free account, and your voice becomes the key. Free to start,
          no credit card.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <a
            href={RELEASE_URL}
            className="rounded-full bg-accent px-9 py-4 text-sm font-semibold text-black transition hover:bg-accent-glow accent-ring"
          >
            Download for Windows
          </a>
          <div className="text-sm text-white/45">v0.1.0 · Windows 10 &amp; 11 · ~250 MB</div>
          <div className="max-w-md text-xs text-white/40">
            Large because the speech and speaker models ship inside it, so your voice is verified
            with no internet. Not code-signed yet, so Windows will say &ldquo;unknown
            publisher&rdquo; — choose <span className="text-white/70">More info → Run anyway</span>.{' '}
            <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              All releases
            </a>
            .
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="glass rounded-3xl p-5">
              <div className="font-mono text-xl text-accent">{s.n}</div>
              <div className="mt-2 font-semibold text-white">{s.t}</div>
              <div className="mt-1 text-sm text-white/55">{s.b}</div>
            </div>
          ))}
        </div>

        <div className="glass-strong mt-6 rounded-3xl p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">Good to know</div>
          <ul className="mt-3 grid gap-2 text-sm text-white/55">
            <li>Starts with Windows and locks automatically. Your voice unlocks it — say anything, it recognizes you, not a passphrase.</li>
            <li>Your voice is verified on your own machine and never uploaded.</li>
            <li>It does not replace the Windows login screen yet — Ctrl+Alt+Del still gets past it. That is next on the roadmap.</li>
            <li>Emergency exit while testing: Ctrl+Alt+Shift+Q.</li>
          </ul>
          <Link
            href="/signup"
            className="mt-5 inline-block rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Create your free account
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
