import type { SystemSnapshot } from '../vite-env'

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
    return snap ?? null
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

  return lines.join('\n')
}
