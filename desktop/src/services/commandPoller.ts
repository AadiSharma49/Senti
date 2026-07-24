import { api } from './api'
import { runAction } from './actions'
import { useWakeStore } from '../state/wakeStore'

/**
 * Remote control, pull-style.
 *
 * Your PC is behind NAT so nothing can push to it. Instead Senti polls for
 * commands you queued from your phone, runs them through the SAME permission
 * dial a spoken command goes through, and reports the real outcome back so the
 * phone shows what actually happened — not just "sent".
 */
const COMMANDS_PATH = '/api/device/commands'
const POLL_MS = 6000

interface RemoteCommand {
  id: string
  action: string
  args: Record<string, unknown>
}

let timer: number | null = null
let busy = false

async function poll(): Promise<void> {
  if (busy) return
  busy = true
  try {
    const res = await api<{ commands?: RemoteCommand[] }>(COMMANDS_PATH)
    if (!res.ok) return
    const commands = res.data?.commands ?? []

    for (const cmd of commands) {
      // Show it on the orb, so a remote command isn't invisible at the machine.
      useWakeStore.setState({ state: 'working', detail: 'From your phone…' })
      try {
        void window.senti?.hudShow?.()
      } catch {
        // no bridge outside Electron
      }

      let result = 'Done.'
      let ok = true
      try {
        const outcome = await runAction({ name: cmd.action, args: cmd.args })
        if (outcome) result = outcome
        // A refusal from the permission dial is a real answer, not a crash.
        ok = !/not allowed/i.test(result)
      } catch {
        result = 'That failed on the PC.'
        ok = false
      }

      await api(COMMANDS_PATH, { method: 'PATCH', body: { id: cmd.id, ok, result } })

      useWakeStore.setState({ state: 'speaking', detail: result })
      await new Promise((r) => setTimeout(r, 1800))
      useWakeStore.setState({ state: 'listening', detail: '' })
      try {
        void window.senti?.hudHide?.()
      } catch {
        // ignore
      }
    }
  } catch {
    // Offline or unlinked — just try again next tick.
  } finally {
    busy = false
  }
}

export function startCommandPolling(): void {
  if (timer !== null) return
  void poll()
  timer = window.setInterval(() => void poll(), POLL_MS)
}

export function stopCommandPolling(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}
