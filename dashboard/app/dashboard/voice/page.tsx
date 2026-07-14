import { auth } from '@clerk/nextjs/server'
import { PageHeader, Card, Badge } from '@/components/ui'
import SentiMark from '@/components/SentiMark'
import VoiceSensitivity from '@/components/VoiceSensitivity'
import DeleteVoiceprintButton from '@/components/DeleteVoiceprintButton'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled } from '@/lib/prisma'
import { getVoiceprintStatus, listDevices } from '@/lib/db'


// Per-user, live data — never serve a cached copy of somebody's devices,
// voiceprint status or security timeline.
export const dynamic = 'force-dynamic'
export default async function VoiceProfilePage() {
  const accounts = clerkEnabled && dbEnabled
  const userId = accounts ? auth().userId : null
  const voiceprint = userId ? await getVoiceprintStatus(userId) : null
  const devices = userId ? await listDevices(userId) : []
  const enrolledDevices = devices.filter((d) => d.voiceEnrolled).length

  return (
    <div>
      <PageHeader
        title="Voice Profile"
        subtitle="Your voice unlocks Senti on every device on your account."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <SentiMark size={56} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Voiceprint</h2>
                {voiceprint ? <Badge tone="good">Enrolled</Badge> : <Badge tone="neutral">Not enrolled</Badge>}
              </div>
              <p className="mt-1 text-sm text-white/50">
                {voiceprint
                  ? `${voiceprint.sampleCount} samples · enrolled ${new Date(
                      voiceprint.createdAt
                    ).toLocaleDateString()}`
                  : 'Enroll on your device — Senti captures your voice there and syncs it to your account.'}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
            {voiceprint
              ? `Synced to ${enrolledDevices} of ${devices.length} linked device${devices.length === 1 ? '' : 's'}. Enrollment and re-enrollment run on your device with the microphone.`
              : 'Open Senti on your computer, link this device, and enroll your voice. It will appear here.'}
          </div>

          {voiceprint && (
            <div className="mt-4">
              <DeleteVoiceprintButton />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Voice sensitivity</h2>
          <p className="mt-1 mb-4 text-sm text-white/50">Higher is stricter.</p>
          <VoiceSensitivity />

          <ul className="mt-6 grid gap-2 text-xs text-white/55">
            <li className="flex gap-2"><span className="text-accent">•</span> Voiceprint is 256 numbers — never audio</li>
            <li className="flex gap-2"><span className="text-accent">•</span> Captured and verified on-device</li>
            <li className="flex gap-2"><span className="text-accent">•</span> Delete anytime, everywhere</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
