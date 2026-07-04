import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-white md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-white/50">{subtitle}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-3xl p-6 ${className}`}>{children}</div>
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-accent">{hint}</div>}
    </Card>
  )
}

const toneClass: Record<string, string> = {
  online: 'bg-green-400/15 text-green-300',
  locked: 'bg-accent/15 text-accent',
  offline: 'bg-white/10 text-white/40',
  good: 'bg-green-400/15 text-green-300',
  bad: 'bg-red-400/15 text-red-300',
  neutral: 'bg-white/10 text-white/60',
}

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClass[tone] ?? toneClass.neutral}`}>
      {children}
    </span>
  )
}
