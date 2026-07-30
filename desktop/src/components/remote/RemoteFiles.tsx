import { useEffect, useState } from 'react'
import { listRemote, downloadRemote, FILE_ROOTS, type FileRoot, type RemoteItem } from '../../services/remoteFiles'

/**
 * Browsing another machine's folders and pulling a file across.
 *
 * The answer to "I'm out and I need that document off my PC". Navigation is
 * root key + relative path throughout, so there's never an absolute path for
 * the other machine to be talked into opening.
 */
export default function RemoteFiles({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  const [root, setRoot] = useState<FileRoot>('documents')
  const [rel, setRel] = useState('')
  const [items, setItems] = useState<RemoteItem[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    setBusy(true)
    setMsg('')
    void listRemote(deviceId, root, rel)
      .then((r) => alive && setItems(r.items))
      .catch((e) => alive && setMsg(e instanceof Error ? e.message : 'Could not list that folder.'))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [deviceId, root, rel])

  const enter = (name: string) => setRel(rel ? `${rel}/${name}` : name)
  const up = () => setRel(rel.split('/').slice(0, -1).join('/'))

  const get = async (name: string) => {
    setMsg(`Fetching ${name}…`)
    try {
      await downloadRemote(deviceId, root, rel ? `${rel}/${name}` : name)
      setMsg(`Saved ${name}.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't fetch that file.")
    }
    setTimeout(() => setMsg(''), 8000)
  }

  const size = (n: number) =>
    n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/40">Files on {deviceName}</span>
        <select
          value={root}
          onChange={(e) => {
            setRoot(e.target.value as FileRoot)
            setRel('')
          }}
          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs capitalize text-white outline-none focus:border-accent/60"
        >
          {FILE_ROOTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {rel && (
          <button onClick={up} className="rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/10">
            ← Back
          </button>
        )}
        <span className="truncate text-xs text-white/30">/{rel}</span>
      </div>

      {msg && <div className="mb-2 text-xs text-accent">{msg}</div>}

      {busy ? (
        <div className="py-4 text-center text-xs text-white/35">Asking {deviceName}…</div>
      ) : items.length === 0 ? (
        <div className="py-4 text-center text-xs text-white/35">Nothing here.</div>
      ) : (
        <div className="max-h-72 overflow-auto">
          {items.map((it) => (
            <div
              key={it.name}
              className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-0"
            >
              <button
                onClick={() => it.dir && enter(it.name)}
                disabled={!it.dir}
                className={`min-w-0 flex-1 truncate text-left text-sm ${
                  it.dir ? 'text-accent hover:underline' : 'cursor-default text-white/85'
                }`}
              >
                {it.dir ? '📁 ' : ''}
                {it.name}
              </button>
              {!it.dir && (
                <>
                  <span className="shrink-0 text-xs text-white/30">{size(it.size)}</span>
                  <button
                    onClick={() => void get(it.name)}
                    className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent hover:bg-accent/20"
                  >
                    Get
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
