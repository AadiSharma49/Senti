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
  | 'seeScreen'
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
  take_screenshot: 'seeScreen',
  look_at_screen: 'seeScreen',
  lock_workstation: 'systemControl',
  power: 'systemControl',
  set_volume: 'systemControl',
  remember: null,
}

/**
 * How Senti describes what it just refused to do.
 *
 * Beside the table on purpose: a new action added above without a phrase here
 * is immediately visible, rather than silently refusing with "I'm not allowed
 * to do that" and leaving the user guessing which switch to look for.
 */
export const DENIED_PHRASE: Record<string, string> = {
  open_app: 'open apps',
  close_app: 'close apps',
  open_folder: 'open your files and folders',
  open_file: 'open your files and folders',
  clean_temp: 'delete temporary files',
  empty_recycle_bin: 'empty the Recycle Bin',
  screen_share: 'share your screen',
  take_screenshot: 'take screenshots',
  look_at_screen: 'look at your screen',
  lock_workstation: 'lock your PC',
  power: 'power off or restart your PC',
  set_volume: 'change the volume',
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
