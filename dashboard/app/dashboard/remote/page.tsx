import { auth } from '@clerk/nextjs/server'
import { PageHeader } from '@/components/ui'
import { listDevices } from '@/lib/db'
import { clerkEnabled } from '@/lib/auth'
import RemoteView from '@/components/RemoteView'

export const dynamic = 'force-dynamic'

/**
 * Remote — check your machines from your phone. Shows what Senti is doing on
 * each one right now, live, and refreshes on its own so you can leave it open
 * while a task runs.
 */
export default async function RemotePage() {
  const userId = clerkEnabled ? auth().userId : null
  const devices = userId ? await listDevices(userId) : []

  const initial = devices.map((d) => ({
    id: d.id,
    name: d.name,
    os: d.os,
    status: d.status,
    activity: d.activity ?? null,
    vitals: d.vitals ?? null,
    reportedAt: d.reportedAt ? d.reportedAt.toISOString() : null,
    lastSeen: d.lastSeen.toISOString(),
  }))

  return (
    <div>
      <PageHeader
        title="Remote"
        subtitle="What Senti is doing on your machines, right now. Leave it open while a task runs."
      />
      <RemoteView initial={initial} />
    </div>
  )
}
