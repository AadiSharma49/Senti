import type { SystemSnapshot } from '../vite-env'
import { habitsContext } from './reflection'

/**
 * systemInfo — a factual snapshot of THIS machine, gathered in the Electron
 * main process.
 *
 * This is Senti's real advantage over a cloud chatbot: it can look at the
 * computer it lives on. "Why is my PC slow?" gets answered with your actual
 * numbers instead of generic advice.
 *
 * Read-only and deliberately narrow — memory, disk, top processes, startup
 * count. No file contents, no screen, no history.
 */
export async function getSystemSnapshot(): Promise<SystemSnapshot | null> {
  try {
    const snap = await window.senti?.systemInfo?.()
    if (!snap) return null
    // Fetched alongside, not inside, systemInfo: it shells out to PowerShell
    // and shouldn't be able to delay or fail the vitals everything else needs.
    try {
      const win = await window.senti?.activeWindow?.()
      if (win) snap.activeWindow = win
    } catch {
      // Not knowing the focused window is survivable.
    }
    try {
      const habits = await habitsContext()
      if (habits) snap.habits = habits
    } catch {
      // No journal yet, or it failed to read — Senti just knows less.
    }
    return snap
  } catch {
    return null
  }
}

/**
 * Compact the snapshot into a few lines of plain text for the assistant's
 * prompt. Sending prose rather than raw JSON keeps the token cost low and the
 * model's answers natural.
 */
export function describeSystem(s: SystemSnapshot): string {
  const lines: string[] = [
    `OS: ${s.os}`,
    `CPU: ${s.cpu} (${s.cores} cores)`,
    `Memory: ${s.ramUsedGB}GB used of ${s.ramTotalGB}GB (${s.ramUsedPct}%)`,
    `Uptime: ${s.uptimeHours}h`,
  ]

  if (s.disks?.length) {
    lines.push(
      'Disks: ' +
        s.disks.map((d) => `${d.drive} ${d.freeGB}GB free of ${d.totalGB}GB (${d.usedPct}% used)`).join('; ')
    )
  }
  if (s.topProcesses?.length) {
    lines.push('Top memory: ' + s.topProcesses.map((p) => `${p.name} ${p.memMB}MB`).join(', '))
  }
  if (typeof s.startupApps === 'number') {
    lines.push(`Startup apps: ${s.startupApps}`)
  }
  // What they're actually looking at, so "what am I doing?" and "why is my PC
  // slow?" can be answered about the real, current situation.
  if (s.activeWindow) {
    lines.push(`Focused right now: "${s.activeWindow.title}" (${s.activeWindow.process})`)
  }
  if (s.habits) {
    lines.push('', s.habits)
  }

  return lines.join('\n')
}
