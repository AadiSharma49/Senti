import { PageHeader, Card } from '@/components/ui'
import SecurityPolicyEditor from '@/components/SecurityPolicyEditor'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Account and security policy — the source of truth for your devices." />

      <div className="grid gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-white">Account</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" value="Aaditya Sharma" />
            <Field label="Email" value="sharmaaaditya142@gmail.com" />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Security policy</h2>
          <p className="mt-1 mb-5 text-sm text-white/50">
            These settings sync down to every device. Devices are secure endpoints — they follow the dashboard.
          </p>
          <SecurityPolicyEditor />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Danger zone</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10">
              Sign out all devices
            </button>
            <button className="rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10">
              Delete account
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.15em] text-white/40">{label}</div>
      <div className="mt-1 text-white/90">{value}</div>
    </div>
  )
}
