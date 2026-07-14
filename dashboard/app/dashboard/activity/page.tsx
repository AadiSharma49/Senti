import { auth } from '@clerk/nextjs/server'
import { PageHeader, Card, Badge } from '@/components/ui'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled } from '@/lib/prisma'
import { listEvents } from '@/lib/db'


// Per-user, live data — never serve a cached copy of somebody's devices,
// voiceprint status or security timeline.
export const dynamic = 'force-dynamic'
const eventMeta: Record<string, { label: string; tone: 'good' | 'bad' | 'neutral' }> = {
  voice_unlock: { label: 'Voice unlock', tone: 'good' },
  pin_unlock: { label: 'PIN unlock', tone: 'neutral' },
  voice_rejected: { label: 'Voice rejected', tone: 'bad' },
  lockout: { label: 'Lockout', tone: 'bad' },
  enrolled: { label: 'Enrolled', tone: 'neutral' },
}

export default async function ActivityPage() {
  const accounts = clerkEnabled && dbEnabled
  const userId = accounts ? auth().userId : null
  const events = userId ? await listEvents(userId, 50) : []

  return (
    <div>
      <PageHeader title="Security Timeline" subtitle="Every unlock, rejection, and lockout across your devices." />
      <Card>
        {events.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/45">
            No events yet. When your devices unlock (or reject an attempt), it shows up here.
          </div>
        ) : (
          <div className="relative grid gap-1">
            {events.map((e) => {
              const meta = eventMeta[e.type] ?? { label: e.type, tone: 'neutral' as const }
              return (
                <div key={e.id} className="flex items-start gap-4 rounded-2xl px-3 py-3 transition hover:bg-white/[0.03]">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent/60" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="text-sm text-white/85">{e.device?.name ?? 'Device'}</span>
                      <span className="text-xs text-white/35">· {new Date(e.createdAt).toLocaleString()}</span>
                    </div>
                    {e.detail && <div className="mt-1 text-xs text-white/45">{e.detail}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
