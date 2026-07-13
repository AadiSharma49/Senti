import { PageHeader, Card } from '@/components/ui'
import SentiMark from '@/components/SentiMark'

export default function DownloadPage() {
  return (
    <div>
      <PageHeader
        title="Download Senti"
        subtitle="Install the desktop app and sign in with this account to sync your voice profile."
      />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,212,255,0.12),transparent_60%)]" />
        <div className="relative flex flex-col items-center gap-6 py-8 text-center">
          <SentiMark size={64} />
          <div>
            <div className="text-xl font-semibold text-white">Senti for Windows</div>
            <div className="mt-1 text-sm text-white/50">v0.1.0 · Windows 10 &amp; 11 · ~120 MB</div>
          </div>
          <a
            href="#"
            className="rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-accent-glow accent-ring"
          >
            Download for Windows
          </a>
          <div className="text-xs text-white/35">macOS &amp; Linux coming soon</div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Step n="01" title="Install" body="Run the installer and launch Senti." />
        <Step n="02" title="Sign in" body="Use this same account inside the app." />
        <Step n="03" title="Enroll your voice" body="Speak naturally a few times — any words. Your voiceprint stays on-device." />
      </div>
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
