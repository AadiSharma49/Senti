import SentiMark from '@/components/SentiMark'

/**
 * Shown while a dashboard page fetches its data. Pages are force-dynamic (they
 * read live per-user data), so there is always a real round trip — without this
 * the user stared at a frozen screen and assumed nothing had happened.
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <div className="senti-pulse">
        <SentiMark size={56} />
      </div>
      <div className="text-xs uppercase tracking-[0.3em] text-secondary">Loading</div>

      {/* Skeleton rows, so the layout doesn't jump when the data lands. */}
      <div className="mt-4 grid w-full max-w-3xl gap-3 px-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="senti-shimmer h-16 rounded-2xl border border-white/5 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  )
}
