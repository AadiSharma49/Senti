import { auth } from '@clerk/nextjs/server'
import { PageHeader, Card, StatTile, Badge } from '@/components/ui'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled } from '@/lib/prisma'
import { listDevices } from '@/lib/db'

// Per-user, live data — never serve a cached copy of somebody's devices.
export const dynamic = 'force-dynamic'

export default async function OverviewPage() {
  const accounts = clerkEnabled && dbEnabled
  const userId = accounts ? auth().userId : null

  const devices = userId ? await listDevices(userId) : []
  const online = devices.filter((d) => d.status !== 'offline' && d.linked).length

  return (
    <div>
      <PageHeader title="Overview" subtitle="Your devices and account, at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Devices" value={String(devices.length)} hint={`${online} active`} />
        <StatTile
          label="Account"
          value={accounts ? 'Signed in' : 'Local'}
          hint={accounts ? 'synced' : 'demo mode'}
        />
        <StatTile label="Remote control" value="Ready" hint="see Remote" />
      </div>

      <div className="mt-8">
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
