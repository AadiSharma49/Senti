import { currentUser } from '@clerk/nextjs/server'
import { PageHeader, Card } from '@/components/ui'
import AccountDangerZone from '@/components/AccountDangerZone'
import { clerkBackendEnabled, clerkEnabled } from '@/lib/auth'

// Per-user, live data — never serve a cached copy of somebody's account.
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = clerkEnabled ? await currentUser().catch(() => null) : null
  const name = user?.fullName || user?.firstName || user?.username || 'Your account'
  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '—'

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account and session security across your browsers and paired PCs." />

      <div className="grid gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-white">Account</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={name} />
            <Field label="Email" value={email} />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Danger zone</h2>
          <p className="mt-1 text-sm text-white/50">
            Revoke active sessions and paired device tokens, or permanently delete your Sentinel account.
          </p>
          <AccountDangerZone clerkEnabled={clerkBackendEnabled} />
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
