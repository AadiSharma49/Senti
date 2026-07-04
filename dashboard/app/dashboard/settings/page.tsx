import { PageHeader, Card } from '@/components/ui'

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
          <p className="mt-1 text-sm text-white/50">
            These settings sync down to every device. Devices are secure endpoints — they follow the dashboard.
          </p>
          <div className="mt-5 grid gap-3">
            <Row label="Voice unlock" desc="Primary authentication method" state="On" />
            <Row label="PIN fallback" desc="Emergency fallback after 3 voice failures" state="On" />
            <Row label="Max attempts before lockout" desc="Failed PIN attempts" state="3" />
            <Row label="Lockout duration" desc="Cool-down after lockout" state="30s" />
            <Row label="Telegram recovery" desc="Remote unlock via Telegram bot" state="Not set up" muted />
          </div>
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

function Row({ label, desc, state, muted }: { label: string; desc: string; state: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
      <div>
        <div className="text-sm text-white/85">{label}</div>
        <div className="text-xs text-white/40">{desc}</div>
      </div>
      <div className={`text-sm font-medium ${muted ? 'text-white/35' : 'text-accent'}`}>{state}</div>
    </div>
  )
}
