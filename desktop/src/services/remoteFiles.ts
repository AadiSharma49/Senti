import { api } from './api'

/**
 * Browsing another of your machines' files, from this one.
 *
 * Queue a request, then wait for that machine to answer. Everything is
 * expressed as a ROOT KEY plus a relative path — never an absolute path —
 * because the owning machine resolves the root itself and refuses anything
 * that escapes it. There is deliberately no way to name an arbitrary location.
 */
const FILES_PATH = '/api/device/files'
const POLL_MS = 900
/** A sleeping or busy PC shouldn't leave the UI hanging forever. */
const TIMEOUT_MS = 45_000

export const FILE_ROOTS = ['desktop', 'documents', 'downloads', 'pictures', 'videos', 'music'] as const
export type FileRoot = (typeof FILE_ROOTS)[number]

export interface RemoteItem {
  name: string
  dir: boolean
  size: number
  modified: number
}

/** Queue a request and wait for the answer. Throws with a readable reason. */
async function request(deviceId: string, kind: 'list' | 'read', root: string, relPath: string): Promise<string> {
  const start = await api<{ id?: string }>(FILES_PATH, {
    method: 'POST',
    body: { deviceId, kind, root, relPath },
  })
  const id = start.data?.id
  if (!start.ok || !id) throw new Error("Couldn't reach that device.")

  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    const res = await api<{ state?: string; payload?: string; error?: string }>(
      `${FILES_PATH}?id=${encodeURIComponent(id)}`
    )
    if (!res.ok) continue
    const { state, payload, error } = res.data ?? {}
    if (state === 'failed') throw new Error(error || 'That machine refused.')
    if (state === 'done' && payload) return payload
  }
  throw new Error('That machine didn’t answer — is it awake and running Senti?')
}

export async function listRemote(
  deviceId: string,
  root: FileRoot,
  relPath = ''
): Promise<{ items: RemoteItem[] }> {
  const raw = await request(deviceId, 'list', root, relPath)
  const parsed = JSON.parse(raw)
  return { items: Array.isArray(parsed.items) ? parsed.items : [] }
}

/**
 * Fetch a file and hand it to the browser as a download. The bytes arrive
 * base64-encoded, so they're decoded here and turned into a blob.
 */
export async function downloadRemote(deviceId: string, root: FileRoot, relPath: string): Promise<string> {
  const raw = await request(deviceId, 'read', root, relPath)
  const parsed = JSON.parse(raw) as { name: string; base64: string }

  const bin = atob(parsed.base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

  const url = URL.createObjectURL(new Blob([bytes]))
  const a = document.createElement('a')
  a.href = url
  a.download = parsed.name
  a.click()
  // Give the download a moment to start before revoking the handle.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return parsed.name
}
