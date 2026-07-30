import { api } from './api'
import { useSettingsStore } from '../state/settingsStore'

/**
 * Answering file requests from your other machines.
 *
 * Polls for work queued against this device, does it against a whitelist of
 * your own folders, and posts the result back. Gated by the same "files"
 * permission that lets Senti open things locally — if you switched that off,
 * this machine simply won't serve anything.
 */
const FILES_PATH = '/api/device/files'
const POLL_MS = 5000

interface FileJob {
  id: string
  kind: string
  root: string
  relPath: string
}

let timer: number | null = null
let busy = false

async function tick(): Promise<void> {
  if (busy) return
  busy = true
  try {
    if (!useSettingsStore.getState().permissions.files) return
    const res = await api<{ requests?: FileJob[] }>(FILES_PATH)
    if (!res.ok) return

    for (const job of res.data?.requests ?? []) {
      try {
        const payload =
          job.kind === 'read'
            ? await window.senti?.serveRead?.(job.root, job.relPath)
            : await window.senti?.serveList?.(job.root, job.relPath)
        await api(FILES_PATH, { method: 'PATCH', body: { id: job.id, payload } })
      } catch (e) {
        // Report the reason rather than leaving the asker waiting forever.
        const message = e instanceof Error ? e.message : 'Could not read that.'
        await api(FILES_PATH, { method: 'PATCH', body: { id: job.id, error: message } })
      }
    }
  } catch {
    // Offline — next tick retries.
  } finally {
    busy = false
  }
}

export function startFileHost(): void {
  if (timer !== null) return
  void tick()
  timer = window.setInterval(() => void tick(), POLL_MS)
}

export function stopFileHost(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}
