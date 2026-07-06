import { PageHeader, Card, Badge } from '@/components/ui'
import SentiMark from '@/components/SentiMark'
import SecurityModeSelector from '@/components/SecurityModeSelector'
import VoiceSensitivity from '@/components/VoiceSensitivity'

export default function VoiceProfilePage() {
  return (
    <div>
      <PageHeader
        title="Voice Profile"
        subtitle="Manage how voice unlock behaves. This policy applies to every device on your account."
      />

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-white">Security mode</h2>
        <p className="mt-1 mb-4 text-sm text-white/50">Choose how strict voice unlock is.</p>
        <SecurityModeSelector />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <SentiMark size={56} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Voice matching</h2>
                <Badge tone="good">Active</Badge>
              </div>
              <p className="mt-1 text-sm text-white/50">
                Model: WeSpeaker ResNet34 · 256-dim embedding, verified on-device
              </p>
            </div>
          </div>

          <div className="mt-6">
            <VoiceSensitivity />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
            Enrollment (learning your voiceprint) runs on your device with the microphone.
            Open Senti on your computer to enroll or re-enroll.
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Privacy</h2>
          <ul className="mt-4 grid gap-3 text-sm text-white/60">
            <li className="flex gap-2"><span className="text-accent">•</span> Voiceprint stored on-device</li>
            <li className="flex gap-2"><span className="text-accent">•</span> Only a 256-number embedding syncs — never audio</li>
            <li className="flex gap-2"><span className="text-accent">•</span> Verification runs locally, offline</li>
            <li className="flex gap-2"><span className="text-accent">•</span> Delete anytime, everywhere</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
