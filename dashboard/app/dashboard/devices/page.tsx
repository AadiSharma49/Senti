import { PageHeader } from '@/components/ui'
import DevicesManager from '@/components/DevicesManager'


// Per-user, live data — never serve a cached copy of somebody's devices.
export const dynamic = 'force-dynamic'
export default function DevicesPage() {
  return (
    <div>
      <PageHeader title="Devices" subtitle="Every computer running Sentinel under your account." />
      <DevicesManager />
    </div>
  )
}
