import { useSettingsStore } from '../state/settingsStore'
import { isActionAllowed, DENIED_PHRASE } from './actionPermissions'
import { startScreenShare, stopScreenShare } from './screenShare'
import { lookAtScreen } from './vision'
import {
  readActiveFile,
  readFile,
  writeFile,
  listFolder,
  runInTerminal,
  getDiagnostics,
  isCodeBridgeConnected,
} from './codeBridge'

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

  if (!isActionAllowed(action.name, perms as unknown as Record<string, boolean>)) {
    return denied(DENIED_PHRASE[action.name] ?? 'do that')
  }

  switch (action.name) {
    case 'open_app': {
      const res = await senti?.openApp?.(target)
      if (res?.ok) {
        return res.focused
          ? `${res.label ?? target} was already open — switched to it.`
          : `Opening ${res.label ?? target}.`
      }
      if (res?.error === 'unknown') return `I don't know how to open ${target} yet.`
      return `I couldn't open ${target}.`
    }

    case 'close_app': {
      const res = await senti?.closeApp?.(target)
      if (res?.ok) return `Closed ${res.label ?? target}.`
      if (res?.error === 'unknown') return `I can't close ${target} yet.`
      return `I couldn't close ${target}.`
    }

    case 'close_current': {
      const res = await senti?.closeCurrentApp?.()
      if (res?.ok) return `Closed ${res.label}.`
      if (res?.error === 'nothing') return 'Nothing was in focus to close.'
      return "I couldn't close the active app just now."
    }

    case 'show_desktop': {
      const ok = await senti?.showDesktop?.()
      return ok ? 'Minimised everything — back to your desktop.' : "I couldn't minimise your windows just now."
    }

    case 'clean_temp': {
      // Do it where you can watch: the folder opens, everything highlights,
      // the files go. "I freed 55 MB" asks you to take it on faith; this
      // doesn't. Falls back to the silent sweep if the window never came up.
      const res = useSettingsStore.getState().showWork
        ? await senti?.cleanTempVisible?.()
        : await senti?.cleanTemp?.()
      if (!res) return "I couldn't clean up just now."
      if (res.files === 0) return 'Nothing to clean — your temp folders are already clear.'
      // Don't claim you watched it happen if the visible pass bailed out.
      const watched = 'shown' in res && res.shown
      return `${watched ? 'There you go.' : 'Done.'} I freed ${
        res.freedMB === 0 ? 'under a megabyte' : res.freedMB + ' megabytes'
      } by deleting ${res.files} temporary files.`
    }

    case 'open_folder': {
      const res = await senti?.openFolder?.(target)
      if (res?.ok) return `Opening ${res.label ?? target}.`
      if (res?.error === 'unknown') return `I'm not sure which folder you mean by ${target}.`
      return `I couldn't open ${target}.`
    }

    case 'open_file': {
      const query = String(action.args?.query ?? action.args?.name ?? '')
      const res = await senti?.openFile?.(query)
      if (res?.ok) {
        const more = res.count && res.count > 1 ? ` I found ${res.count}; say "next" for another.` : ''
        return `Opening ${res.label}.${more}`
      }
      if (res?.error === 'not-found') return `I couldn't find a file matching "${query}" in your folders.`
      return `I couldn't open that file.`
    }

    case 'screen_share': {
      const on = action.args?.on !== false // default to starting
      if (on) {
        const ok = await startScreenShare()
        return ok ? 'Sharing your screen — you can watch it from your phone now.' : "I couldn't start screen sharing."
      }
      await stopScreenShare()
      return 'Stopped sharing your screen.'
    }

    case 'take_screenshot': {
      const res = await senti?.screenshotSave?.()
      if (!res?.ok) return "I couldn't grab your screen just now."
      // Name the folder, not the full path — "Pictures, Senti" is something
      // you can act on; a 90-character path read aloud is noise.
      return 'Got it. Saved to your Pictures folder, under Senti.'
    }

    case 'look_at_screen': {
      const question = String(action.args?.question ?? '').trim()
      return await lookAtScreen(question)
    }

    case 'remember': {
      // Not a system action — just saving a fact. No permission gate; it only
      // ever writes to Senti's local memory file, nothing on the machine.
      const fact = String(action.args?.fact ?? '').trim()
      if (!fact) return null
      await senti?.memoryAdd?.(fact)
      return null // let Senti keep its own natural wording; nothing to override
    }

    case 'empty_recycle_bin': {
      const res = await senti?.emptyRecycleBin?.()
      if (!res) return "I couldn't empty the Recycle Bin just now."
      if (res.files === 0) return 'The Recycle Bin is already empty.'
      return `Done. I emptied the Recycle Bin — ${res.files} ${
        res.files === 1 ? 'item' : 'items'
      }${res.freedMB > 0 ? `, freeing ${res.freedMB} megabytes` : ''}.`
    }

    case 'power': {
      const mode = String(action.args?.mode ?? '').toLowerCase()
      const ok = await senti?.power?.(mode)
      if (!ok) return "I couldn't do that just now."
      return mode === 'sleep'
        ? 'Putting your PC to sleep.'
        : mode === 'restart' || mode === 'reboot'
        ? 'Restarting your PC now.'
        : 'Shutting your PC down now. Heads up — I can’t turn it back on remotely.'
    }

    case 'lock_workstation': {
      const ok = await senti?.lockWorkstation?.()
      return ok ? 'Locking your PC.' : "I couldn't lock it."
    }

    case 'set_volume': {
      const dir = action.args?.direction
      const d = dir === 'up' || dir === 'down' || dir === 'mute' ? dir : null
      if (!d) return null
      const ok = await senti?.volume?.(d)
      if (!ok) return "I couldn't change the volume."
      return d === 'mute' ? 'Muted.' : d === 'up' ? 'Turning it up.' : 'Turning it down.'
    }

    case 'read_file': {
      const path = String(action.args?.path ?? '')
      if (!path) return 'Which file do you want me to read?'
      const content = await readFile(path)
      if (!content) return `I couldn't read ${path} — is VS Code open and the Senti Code Bridge connected?`
      return `Here's what's in ${path}:\n${content.text.slice(0, 3000)}${content.text.length > 3000 ? '\n... (truncated)' : ''}`
    }

    case 'write_file': {
      const path = String(action.args?.path ?? '')
      const text = String(action.args?.text ?? '')
      if (!path || !text) return 'I need a file path and content to write.'
      const ok = await writeFile(path, text)
      if (!ok) return `I couldn't write to ${path} — is VS Code open and the Senti Code Bridge connected?`
      return `Done. Wrote ${text.length} characters to ${path}.`
    }

    case 'run_command': {
      const command = String(action.args?.command ?? '')
      if (!command) return 'What command should I run?'
      const ok = await runInTerminal(command)
      if (!ok) return `I couldn't run that — is VS Code open and the Senti Code Bridge connected?`
      return `Sent "${command}" to the terminal. Check the output there.`
    }

    case 'list_folder': {
      const folder = String(action.args?.folder ?? '')
      if (!folder) return 'Which folder should I list?'
      const listing = await listFolder(folder)
      if (!listing) return `I couldn't list ${folder} — is VS Code open and the Senti Code Bridge connected?`
      const files = listing.files.slice(0, 20).join(', ') || '(empty)'
      const folders = listing.folders.slice(0, 10).join(', ') || '(none)'
      return `${folder} contains:\nFiles: ${files}\nFolders: ${folders}`
    }

    case 'get_active_file': {
      const active = await readActiveFile()
      if (!active) return 'No file is open in the editor right now.'
      return `The active file is ${active.path} (${active.language}):\n${active.text.slice(0, 3000)}${active.text.length > 3000 ? '\n... (truncated)' : ''}`
    }

    case 'get_diagnostics': {
      const diags = await getDiagnostics()
      const entries: string[] = []
      for (const [path, items] of Object.entries(diags).slice(0, 10)) {
        for (const d of items.slice(0, 5)) {
          entries.push(`${path}:${d.line} — ${d.severity}: ${d.message}`)
        }
      }
      if (!entries.length) return 'No errors or warnings — clean code.'
      return `Found ${entries.length} issue(s):\n${entries.slice(0, 15).join('\n')}`
    }

    case 'plan': {
      // The plan tool is handled by the LLM itself — it just acknowledges
      // and continues executing steps. No system action needed.
      return null
    }

    default:
      return null
  }
}
