import { PageHeader, Card, Badge } from '@/components/ui'
import { devices } from '@/lib/mockData'

export default function DevicesPage() {
  return (
    <div>
      <PageHeader title="Devices" subtitle="Every computer running Senti under your account." />
      <div className="grid gap-4">
        {devices.map((d) => (
          <Card key={d.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-xl">🖥</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white">{d.name}</span>
                  <Badge tone={d.status}>{d.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {d.os} · last seen {d.lastSeen}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={d.voiceEnrolled ? 'good' : 'neutral'}>
                {d.voiceEnrolled ? '🎙 Voice enrolled' : 'No voice profile'}
              </Badge>
              <button className="rounded-full border border-red-400/30 px-4 py-2 text-xs text-red-300 transition hover:bg-red-500/10">
                Remove
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
