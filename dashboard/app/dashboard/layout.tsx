import Link from 'next/link'
import SentiMark from '@/components/SentiMark'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: '▚' },
  { href: '/dashboard/devices', label: 'Devices', icon: '▢' },
  { href: '/dashboard/voice', label: 'Voice Profile', icon: '◉' },
  { href: '/dashboard/activity', label: 'Security Timeline', icon: '‖' },
  { href: '/dashboard/download', label: 'Download', icon: '↓' },
  { href: '/dashboard/settings', label: 'Settings', icon: '◇' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ambient flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/5 p-6 md:block">
        <Link href="/" className="mb-10 flex items-center gap-3">
          <SentiMark size={30} />
          <span className="text-lg font-semibold tracking-wide">Senti</span>
        </Link>
        <nav className="grid gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              <span className="w-5 text-center opacity-70">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-10 border-t border-white/5 pt-6">
          <Link href="/login" className="flex items-center gap-3 px-3 text-sm text-white/40 transition hover:text-white">
            ← Sign out
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
    </div>
  )
}
