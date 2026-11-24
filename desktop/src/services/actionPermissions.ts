import { EDITOR_COMMANDS } from '../../../shared/codeBridgeActions'

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
  | 'codeBridge'
  | 'screenShare'
  | 'seeScreen'
  | 'systemControl'

/**
 * null means "needs no permission" — and every one of those is deliberate:
 * `remember` only writes to Sentinel's own local memory file. It touches
 * nothing on the machine.
 */
export const ACTION_PERMISSIONS: Record<string, PermissionKey | null> = {
  ...Object.fromEntries(Object.keys(EDITOR_COMMANDS).map(name => [name, 'codeBridge' as const])),
  open_app: 'openApps',
  close_app: 'closeApps',
  close_current: 'closeApps',
  show_desktop: 'systemControl',
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

export const DENIED_PHRASE: Record<string, string> = {
  ...Object.fromEntries(Object.keys(EDITOR_COMMANDS).map(name => [name, 'use the VS Code bridge'])),
  open_app: 'open apps',
  close_app: 'close apps',
  close_current: 'close apps',
  show_desktop: 'minimise windows',
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
  if (!Object.prototype.hasOwnProperty.call(ACTION_PERMISSIONS, action)) return false
  const key = ACTION_PERMISSIONS[action]
  if (key === null) return true
  return perms[key] === true
}
