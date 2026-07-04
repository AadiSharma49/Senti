import { PageHeader, Card, Badge } from '@/components/ui'
import { activity, eventMeta } from '@/lib/mockData'

export default function ActivityPage() {
  return (
    <div>
      <PageHeader title="Security Timeline" subtitle="Every unlock, rejection, and lockout across your devices." />
      <Card>
        <div className="relative grid gap-1">
          {activity.map((e) => {
            const meta = eventMeta[e.type]
            return (
              <div key={e.id} className="flex items-start gap-4 rounded-2xl px-3 py-3 transition hover:bg-white/[0.03]">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent/60" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-sm text-white/85">{e.device}</span>
                    <span className="text-xs text-white/35">· {e.when}</span>
                  </div>
                  <div className="mt-1 text-xs text-white/45">{e.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
