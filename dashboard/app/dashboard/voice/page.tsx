import { PageHeader, Card, Badge } from '@/components/ui'
import SentiMark from '@/components/SentiMark'
import SecurityModeSelector from '@/components/SecurityModeSelector'

export default function VoiceProfilePage() {
  return (
    <div>
      <PageHeader
        title="Voice Profile"
        subtitle="Your voiceprint is enrolled on your devices and synced to your account."
      />

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-white">Security mode</h2>
        <p className="mt-1 mb-4 text-sm text-white/50">
          Choose how strict voice unlock is. This policy applies to every device on your account.
        </p>
        <SecurityModeSelector initial="phrase_and_voice" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <SentiMark size={56} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Primary voiceprint</h2>
                <Badge tone="good">Active</Badge>
              </div>
              <p className="mt-1 text-sm text-white/50">
                Model: WeSpeaker ResNet34 · 256-dim embedding · enrolled on 2 devices
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Meter label="Enrollment samples" value="3" />
            <Meter label="Match threshold" value="0.50" />
            <Meter label="Avg match score" value="0.79" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-accent-glow">
              Re-enroll voice
            </button>
            <button className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/5">
              Adjust sensitivity
            </button>
            <button className="rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10">
              Delete voiceprint
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Privacy</h2>
          <ul className="mt-4 grid gap-3 text-sm text-white/60">
            <li className="flex gap-2"><span className="text-accent">✓</span> Voiceprint stored on-device</li>
            <li className="flex gap-2"><span className="text-accent">✓</span> Only a 256-number embedding syncs — never audio</li>
            <li className="flex gap-2"><span className="text-accent">✓</span> Verification runs locally, offline</li>
            <li className="flex gap-2"><span className="text-accent">✓</span> Delete anytime, everywhere</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.15em] text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
