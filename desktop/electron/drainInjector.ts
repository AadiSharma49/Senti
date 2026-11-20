import type { ChildProcess } from 'node:child_process'

/** EOF is the acknowledgment protocol: PowerShell exits its ReadLine loop
 * only after consuming all preceding commands. stdin 'finish' alone isn't
 * enough (the child might still be compiling Add-Type). Only kill on timeout. */
export function drainInjector(child: ChildProcess, release: () => void): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      child.off('close', done)
      clearTimeout(timeout)
      resolve()
    }
    const timeout = setTimeout(() => {
      try { child.kill() } catch { /* already closed */ }
      done()
    }, 4000)
    child.once('close', done)
    try { release() } finally {
      try { child.stdin?.end() } catch { /* wait for close or deadline */ }
    }
  })
}
