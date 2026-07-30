import path from 'path'

/**
 * Keeping remote file access inside the folders you actually shared.
 *
 * Pulled out of main.ts so it can be tested without Electron. That matters
 * more here than anywhere else in the app: this one function is what stands
 * between "browse my Documents from my laptop" and "read my entire drive from
 * anywhere", and a silent regression in it would not be visible from the UI.
 *
 * The rule: callers never send a path. They send a root KEY plus a relative
 * path, we resolve the root ourselves, join, and verify the result is still
 * inside. `path.resolve` collapses any `..` first, so an attempt to climb out
 * lands somewhere that fails the prefix check.
 */

/** The only folders that can ever be served, by key. */
export const FILE_ROOT_KEYS = ['desktop', 'documents', 'downloads', 'pictures', 'videos', 'music'] as const
export type FileRootKey = (typeof FILE_ROOT_KEYS)[number]

export function isFileRootKey(k: string): k is FileRootKey {
  return (FILE_ROOT_KEYS as readonly string[]).includes(k)
}

/**
 * Resolve `relPath` inside `baseDir`, or null if it escapes.
 *
 * `baseDir` is supplied by the caller in main (from app.getPath) so this stays
 * free of Electron and therefore testable.
 */
export function resolveInside(baseDir: string, relPath: string): string | null {
  const base = path.resolve(baseDir)
  const full = path.resolve(base, relPath || '')
  // Compare against base + separator so a sibling folder that merely starts
  // with the same characters ("Documents2" vs "Documents") can't sneak past.
  const withSep = base.endsWith(path.sep) ? base : base + path.sep
  if (full !== base && !full.startsWith(withSep)) return null
  return full
}
