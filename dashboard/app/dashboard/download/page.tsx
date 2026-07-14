import Link from 'next/link'
import { PageHeader, Card } from '@/components/ui'
import SentiMark from '@/components/SentiMark'

export const dynamic = 'force-dynamic'

/**
 * The installer is ~250 MB (it ships the speech and speaker models so Senti
 * works fully offline). That is past Vercel's static limit and too big for git,
 * so it lives on GitHub Releases. The `/releases/latest/download/<asset>` URL
 * always points at the newest build, and the asset name is stable
 * (Senti-Setup.exe), so this is a true one-click download that never breaks
 * between versions. Override with NEXT_PUBLIC_DOWNLOAD_URL if you host it
 * elsewhere.
 */
const RELEASE_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL ||
  'https://github.com/AadiSharma49/Senti/releases/download/Software/Senti-Setup-0.1.0.exe'

// The releases page, for when someone wants notes or an older build.
const RELEASES_PAGE = 'https://github.com/AadiSharma49/Senti/releases'

export default function DownloadPage() {
  return (
    <div>
      <PageHeader
        title="Download Senti"
        subtitle="Install the desktop app, link it to this account, and your voice becomes the key."
      />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,212,255,0.12),transparent_60%)]" />
        <div className="relative flex flex-col items-center gap-6 py-8 text-center">
          <SentiMark size={64} />
          <div>
            <div className="text-xl font-semibold text-white">Senti for Windows</div>
            <div className="mt-1 text-sm text-white/50">
              v0.1.0 · Windows 10 &amp; 11 · ~250 MB
            </div>
            <div className="mt-1 text-xs text-white/35">
              Large because the speech and speaker models ship inside it — Senti verifies your
              voice with no internet at all.
            </div>
          </div>

          <a
            href={RELEASE_URL}
            className="rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-accent-glow accent-ring"
          >
            Download for Windows
          </a>

          <div className="max-w-md text-xs text-white/40">
            The installer is not code-signed yet, so Windows will say &ldquo;unknown
            publisher&rdquo;. Choose <span className="text-white/70">More info → Run anyway</span>.
            {' '}Or see{' '}
            <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              all releases
            </a>
            .
          </div>
          <div className="text-xs text-white/35">macOS &amp; Linux coming soon</div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Step n="01" title="Install and launch" body="Run the installer. Senti opens straight into first-time setup." />
        <Step
          n="02"
          title="Link this device"
          body="Setup asks for a pairing token first. Get one from Devices — it takes one click."
        />
        <Step n="03" title="Set a PIN" body="Your emergency fallback, in case your voice is unavailable." />
        <Step
          n="04"
          title="Enroll your voice"
          body="Read five short lines. Senti learns your voice, not the words — so afterwards you can say anything."
        />
      </div>

      <Card className="mt-6">
        <div className="text-xs uppercase tracking-[0.3em] text-accent">Before you install</div>
        <div className="mt-2 font-semibold text-white">Grab your pairing token first</div>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Senti asks for it on the very first screen. It is what lets the app greet you by name,
          answer you, and carry your voiceprint to your other machines. Without it, the assistant
          stays switched off.
        </p>
        <Link
          href="/dashboard/devices"
          className="mt-4 inline-block rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Get a pairing token
        </Link>
      </Card>

      <Card className="mt-6">
        <div className="text-xs uppercase tracking-[0.3em] text-accent">What it does on Windows</div>
        <ul className="mt-3 grid gap-2 text-sm text-white/55">
          <li>Starts automatically when Windows starts, and locks immediately.</li>
          <li>While locked it blocks Alt+Tab, Alt+F4 and closing the window.</li>
          <li>
            It does not replace the Windows login screen yet — Ctrl+Alt+Del still gets past it.
            That needs a signed Windows credential provider, which is in progress.
          </li>
          <li>Emergency exit while testing: Ctrl+Alt+Shift+Q.</li>
        </ul>
      </Card>
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Card>
      <div className="font-mono text-xl text-accent">{n}</div>
      <div className="mt-2 font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-white/55">{body}</div>
    </Card>
  )
}
