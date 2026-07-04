import { PageHeader, Card, StatTile, Badge } from '@/components/ui'
import { devices, activity, eventMeta } from '@/lib/mockData'

export default function OverviewPage() {
  const online = devices.filter((d) => d.status !== 'offline').length
  const enrolled = devices.filter((d) => d.voiceEnrolled).length

  return (
    <div>
      <PageHeader title="Overview" subtitle="Your security at a glance across all devices." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Devices" value={String(devices.length)} hint={`${online} active`} />
        <StatTile label="Voice enrolled" value={`${enrolled}/${devices.length}`} hint="profiles synced" />
        <StatTile label="Unlocks today" value="12" hint="10 by voice" />
        <StatTile label="Failed attempts" value="1" hint="last 24h" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent activity</h2>
            <a href="/dashboard/activity" className="text-xs text-accent hover:underline">View all</a>
          </div>
          <div className="grid gap-2">
            {activity.slice(0, 5).map((e) => {
              const meta = eventMeta[e.type]
              return (
                <div key={e.id} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="text-sm text-white/80">{e.device}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/45">{e.detail}</div>
                  </div>
                  <div className="text-xs text-white/35">{e.when}</div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Devices</h2>
          <div className="grid gap-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
                <div>
                  <div className="text-sm text-white/85">{d.name}</div>
                  <div className="text-xs text-white/40">{d.os}</div>
                </div>
                <Badge tone={d.status}>{d.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
