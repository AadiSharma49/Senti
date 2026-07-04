import { useLockStore } from '../state/lockStore'
import type { SessionState } from '../types/auth'

/**
 * lockBridge - keeps the Electron main process informed of the renderer's
 * auth state so it can harden the window (swallow escape hotkeys, block
 * close) while locked and release everything once unlocked.
 *
 * "Locked" = any state other than `unlocked`. Runs only inside Electron
 * (where window.senti exists); a no-op in a plain browser.
 */
export function initLockBridge(): void {
  const senti = window.senti
  if (!senti || typeof senti.setLockState !== 'function') return

  const push = (state: SessionState) => {
    const locked = state !== 'unlocked'
    void senti.setLockState(locked)
  }

  // Push the initial state, then on every change.
  push(useLockStore.getState().state)
  useLockStore.subscribe((s, prev) => {
    if (s.state !== prev.state) push(s.state)
  })
}
