'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_POLICY, type Policy } from '@/lib/policy'

/**
 * Loads the account security policy from /api/policy and saves patches
 * back. Optimistic: UI updates immediately, then reconciles with the
 * server's normalized result.
 */
export function usePolicy() {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/policy')
      .then((r) => r.json())
      .then((p: Policy) => {
        if (alive) setPolicy(p)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const save = useCallback(
    async (patch: Partial<Policy>) => {
      setPolicy((prev) => ({ ...prev, ...patch }))
      setSaving(true)
      try {
        const res = await fetch('/api/policy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const saved: Policy = await res.json()
        setPolicy(saved)
      } catch {
        // keep optimistic value on network error
      } finally {
        setSaving(false)
      }
    },
    []
  )

  return { policy, loading, saving, save }
}
