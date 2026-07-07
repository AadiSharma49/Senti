import { PageHeader } from '@/components/ui'
import DevicesManager from '@/components/DevicesManager'

export default function DevicesPage() {
  return (
    <div>
      <PageHeader title="Devices" subtitle="Every computer running Senti under your account." />
      <DevicesManager />
    </div>
  )
}
