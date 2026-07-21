import { useSettingsStore } from '../state/settingsStore'

/**
 * Carry out an action the model asked for.
 *
 * Two gates stand before anything happens: the user's permission dial, and the
 * whitelist inside the Electron main process. Returns the line Senti should
 * actually say (the real outcome), or null to keep the model's wording.
 *
 * Shared by the tap-to-talk assistant and the hands-free wake word.
 */
export async function runAction(action: {
  name: string
  args: Record<string, unknown>
}): Promise<string | null> {
  const perms = useSettingsStore.getState().permissions
  const senti = window.senti
  const target = String(action.args?.name ?? '')
  const denied = (what: string) => `I'm not allowed to ${what}. You can turn that on in Settings.`

  switch (action.name) {
    case 'open_app': {
      if (!perms.openApps) return denied('open apps')
      const res = await senti?.openApp?.(target)
      if (res?.ok) return `Opening ${res.label ?? target}.`
      if (res?.error === 'unknown') return `I don't know how to open ${target} yet.`
      return `I couldn't open ${target}.`
    }

    case 'close_app': {
      if (!perms.closeApps) return denied('close apps')
      const res = await senti?.closeApp?.(target)
      if (res?.ok) return `Closed ${res.label ?? target}.`
      if (res?.error === 'unknown') return `I can't close ${target} yet.`
      return `I couldn't close ${target}.`
    }

    case 'clean_temp': {
      if (!perms.cleanup) return denied('delete temporary files')
      const res = await senti?.cleanTemp?.()
      if (!res) return "I couldn't clean up just now."
      if (res.files === 0) return 'Nothing to clean — your temp folders are already clear.'
      return `Done. I freed ${
        res.freedMB === 0 ? 'under a megabyte' : res.freedMB + ' megabytes'
      } by deleting ${res.files} temporary files.`
    }

    case 'lock_workstation': {
      if (!perms.systemControl) return denied('lock your PC')
      const ok = await senti?.lockWorkstation?.()
      return ok ? 'Locking your PC.' : "I couldn't lock it."
    }

    case 'set_volume': {
      if (!perms.systemControl) return denied('change the volume')
      const dir = action.args?.direction
      const d = dir === 'up' || dir === 'down' || dir === 'mute' ? dir : null
      if (!d) return null
      const ok = await senti?.volume?.(d)
      if (!ok) return "I couldn't change the volume."
      return d === 'mute' ? 'Muted.' : d === 'up' ? 'Turning it up.' : 'Turning it down.'
    }

    default:
      return null
  }
}
