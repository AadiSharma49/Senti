/** Wire-independent chat contract, compiled into the dashboard and the renderer. */
export const CODE_BRIDGE_VERSION = 1
export const EDITOR_COMMANDS = {
  read_file: 'read_file',
  write_file: 'write_file',
  list_files: 'list_files',
  run_tests: 'run_tests',
  get_active_file: 'get_active_file',
  get_diagnostics: 'get_diagnostics',
  // Desktop open_file already searches the user's OS folders.
  open_editor_file: 'open_file',
  get_git_status: 'get_git_status',
} as const
export type EditorAction = keyof typeof EDITOR_COMMANDS
export const isEditorAction = (name: string): name is EditorAction =>
  Object.prototype.hasOwnProperty.call(EDITOR_COMMANDS, name)

export const MAX_PATH_LENGTH = 2048
export const MAX_WRITE_BYTES = 64 * 1024
// With the Unicode flag a valid surrogate pair is one code point and doesn't
// match. Don't silently encode an unpaired surrogate as a replacement character.
const malformedUnicode = new RegExp('[\\uD800-\\uDFFF]', 'u')

function validPath(value: unknown, directory: boolean): value is string {
  if (directory && value === '.') return true
  if (typeof value !== 'string' || value.length > MAX_PATH_LENGTH || !value.trim() || malformedUnicode.test(value)) return false
  // Both separators are recognised, independent of the server OS. The extension
  // performs the authoritative realpath, symlink, reserved-name and trust checks.
  const parts = value.split(/[\\/]/)
  return parts.every(part => part && part !== '.' && part !== '..' && !/[<>:"|?*\x00-\x1f\x7f]/.test(part))
}

/** Reject, don't coerce, omit unexpected fields, trim a path, or clip a write. */
export function editorArgs(name: EditorAction, input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null
  const proto = Object.getPrototypeOf(input)
  if (proto !== null && proto !== Object.prototype) return null
  const args = input as Record<string, unknown>
  const keys = Object.keys(args)
  if (name === 'list_files' && keys.length === 0) return {}
  if (name === 'write_file') {
    const { path, text } = args
    if (keys.length !== 2 || !keys.includes('path') || !keys.includes('text') || !validPath(path, false) ||
        typeof text !== 'string' || text.length > MAX_WRITE_BYTES || text.includes('\0') || malformedUnicode.test(text) ||
        new TextEncoder().encode(text).length > MAX_WRITE_BYTES) return null
    return { path, text }
  }
  if (name === 'read_file' || name === 'open_editor_file' || name === 'list_files') {
    return keys.length === 1 && keys[0] === 'path' && validPath(args.path, name === 'list_files') ? { path: args.path } : null
  }
  return keys.length === 0 ? {} : null
}
