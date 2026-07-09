import { auth } from '@clerk/nextjs/server'
import { PageHeader, Card, StatTile, Badge } from '@/components/ui'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled } from '@/lib/prisma'
import { listDevices, listEvents, getVoiceprintStatus } from '@/lib/db'

const eventMeta: Record<string, { label: string; tone: 'good' | 'bad' | 'neutral' }> = {
  voice_unlock: { label: 'Voice unlock', tone: 'good' },
  pin_unlock: { label: 'PIN unlock', tone: 'neutral' },
  voice_rejected: { label: 'Voice rejected', tone: 'bad' },
  lockout: { label: 'Lockout', tone: 'bad' },
  enrolled: { label: 'Enrolled', tone: 'neutral' },
}

export default async function OverviewPage() {
  const accounts = clerkEnabled && dbEnabled
  const userId = accounts ? auth().userId : null

  const devices = userId ? await listDevices(userId) : []
  const events = userId ? await listEvents(userId, 5) : []
  const voiceprint = userId ? await getVoiceprintStatus(userId) : null

  const online = devices.filter((d) => d.status !== 'offline' && d.linked).length
  const enrolledDevices = devices.filter((d) => d.voiceEnrolled).length
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const unlocksToday = events.length // (recent window; full count once event logging lands)

  return (
    <div>
      <PageHeader title="Overview" subtitle="Your security at a glance across all devices." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Devices" value={String(devices.length)} hint={`${online} active`} />
        <StatTile
          label="Voice"
          value={voiceprint ? 'Enrolled' : 'Not set'}
          hint={`${enrolledDevices} device${enrolledDevices === 1 ? '' : 's'}`}
        />
        <StatTile label="Recent unlocks" value={String(unlocksToday)} hint="last events" />
        <StatTile
          label="Account"
          value={accounts ? 'Signed in' : 'Local'}
          hint={accounts ? 'synced' : 'demo mode'}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent activity</h2>
            <a href="/dashboard/activity" className="text-xs text-accent hover:underline">View all</a>
          </div>
          {events.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/45">
              No activity yet. Unlock events from your devices will appear here.
            </div>
          ) : (
            <div className="grid gap-2">
              {events.map((e) => {
                const meta = eventMeta[e.type] ?? { label: e.type, tone: 'neutral' as const }
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-sm text-white/80">{e.device?.name ?? 'Device'}</span>
                      </div>
                      {e.detail && <div className="mt-1 text-xs text-white/45">{e.detail}</div>}
                    </div>
                    <div className="text-xs text-white/35">{new Date(e.createdAt).toLocaleString()}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Devices</h2>
          {devices.length === 0 ? (
            <div className="text-sm text-white/45">
              No devices linked. Go to Devices → Link a device.
            </div>
          ) : (
            <div className="grid gap-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
                  <div>
                    <div className="text-sm text-white/85">{d.name}</div>
                    <div className="text-xs text-white/40">{d.os}</div>
                  </div>
                  <Badge tone={d.linked ? d.status : 'offline'}>{d.linked ? d.status : 'not linked'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
