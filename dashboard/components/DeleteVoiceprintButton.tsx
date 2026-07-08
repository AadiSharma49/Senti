'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteVoiceprintButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const del = async () => {
    if (!confirm('Delete your voiceprint everywhere? Your devices will need to re-enroll.')) return
    setBusy(true)
    try {
      await fetch('/api/voiceprint', { method: 'DELETE' })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={del}
      disabled={busy}
      className="rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete voiceprint'}
    </button>
  )
}
