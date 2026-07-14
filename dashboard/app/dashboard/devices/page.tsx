import { PageHeader } from '@/components/ui'
import DevicesManager from '@/components/DevicesManager'


// Per-user, live data — never serve a cached copy of somebody's devices,
// voiceprint status or security timeline.
export const dynamic = 'force-dynamic'
export default function DevicesPage() {
  return (
    <div>
      <PageHeader title="Devices" subtitle="Every computer running Senti under your account." />
      <DevicesManager />
    </div>
  )
}
