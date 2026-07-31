/**
 * Which switch in the Control Center governs which action.
 *
 * A table rather than scattered `if` checks, so the mapping can be tested
 * directly. The failure this guards against is quiet and bad: a new action
 * shipped with no permission attached would run regardless of what the user
 * had switched off, and nothing in the UI would reveal it.
 */
export type PermissionKey =
  | 'openApps'
  | 'closeApps'
  | 'cleanup'
  | 'files'
  | 'screenShare'
  | 'systemControl'

/**
 * null means "needs no permission" — and every one of those is deliberate:
 * `remember` only writes to Senti's own local memory file. It touches
 * nothing on the machine.
 */
export const ACTION_PERMISSIONS: Record<string, PermissionKey | null> = {
  open_app: 'openApps',
  close_app: 'closeApps',
  open_folder: 'files',
  open_file: 'files',
  clean_temp: 'cleanup',
  empty_recycle_bin: 'cleanup',
  screen_share: 'screenShare',
  lock_workstation: 'systemControl',
  power: 'systemControl',
  set_volume: 'systemControl',
  remember: null,
}

/** True when this action may run under the given permission settings. */
export function isActionAllowed(action: string, perms: Record<string, boolean>): boolean {
  // An action we don't recognise is refused rather than allowed. Failing shut
  // is the only safe default for something that acts on a real machine.
  if (!(action in ACTION_PERMISSIONS)) return false
  const key = ACTION_PERMISSIONS[action]
  if (key === null) return true
  return perms[key] === true
}
