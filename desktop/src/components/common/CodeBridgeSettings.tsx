import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../state/settingsStore'
import { useWakeStore } from '../../state/wakeStore'

export default function CodeBridgeSettings() {
  const allowed = useSettingsStore((s) => s.permissions.codeBridge)
  const setPermissions = useSettingsStore((s) => s.setPermissions)
  const latest = useWakeStore((s) => s.editorResult)
  const [status, setStatus] = useState('Checking…')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      try {
        const current = await window.senti?.codeBridgeStatus?.()
        if (alive) setStatus(current ?? 'Requires the Sentinel desktop app.')
      } catch {
        if (alive) setStatus('Could not reach the desktop bridge.')
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 2000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])

  const changePairing = async (pair: boolean) => {
    setBusy(true)
    setMessage('')
    try {
      const result = pair ? await window.senti.codeBridgePair() : await window.senti.codeBridgeDisable()
      if (result.ok || !pair) {
        setPermissions({ codeBridge: pair })
        useWakeStore.setState({ editorResult: '' })
      }
      setMessage(result.text)
      setStatus(await window.senti.codeBridgeStatus())
    } catch {
      setMessage('Cannot change pairing. Check that the Sentinel desktop app is running.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h4 className="section-title">VS Code integration</h4>
      <p className="section-sub">Pair the Sentinel extension in one trusted local workspace to read the active file,
        edit files, check Git or run a test task. VS Code asks before writes and test runs.</p>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <p role="status">{status} · Voice commands {allowed ? 'enabled' : 'off'}</p>
        <p className="mt-2 text-xs text-secondary">Install the extension, choose Pair, then run <strong>Sentinel: Pair Workspace Bridge</strong> in the VS Code Command Palette. The key is for this PC only; do not paste it into chat.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void changePairing(true)} className="rounded-full border border-accent/40 px-4 py-1.5 text-accent disabled:opacity-50">
            {allowed ? 'Pair again (replace key)' : 'Pair VS Code'}
          </button>
          <button type="button" disabled={busy} onClick={() => void changePairing(false)} className="rounded-full border border-white/15 px-4 py-1.5 disabled:opacity-50">
            Disable &amp; revoke key
          </button>
        </div>
        {message && <p role="status" className="mt-2 text-xs">{message}</p>}
        {allowed && latest && <details className="mt-3 border-t border-white/15 pt-3">
          <summary>Last VS Code reply (local only)</summary>
          <pre className="my-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs">{latest}</pre>
          <button type="button" onClick={() => useWakeStore.setState({ editorResult: '' })} className="text-xs text-accent">Clear reply</button>
        </details>}
      </div>
    </section>
  )
}
