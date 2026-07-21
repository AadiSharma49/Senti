import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../../state/uiStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useVoiceProfileStore } from '../../state/voiceProfileStore'
import { useDeviceStore } from '../../state/deviceStore'
import { syncPolicyFromDashboard } from '../../services/policySync'
import { uploadVoiceprint, ensureVoiceprint } from '../../services/voiceprintSync'
import { apiBase, apiOverride, setApiBase } from '../../config'
import VoiceEnrollment from '../onboarding/VoiceEnrollment'

/**
 * Control Center. Voice can be enrolled/re-enrolled here; PIN and account
 * linking are managed too. (Dashboard remains the future source of truth.)
 */
export default function SettingsPanel() {
  const open = useUiStore((s) => s.settingsOpen)
  const close = useUiStore((s) => s.closeSettings)

  const resetConfiguration = useSettingsStore((s) => s.resetConfiguration)
  const permissions = useSettingsStore((s) => s.permissions)
  const setPermissions = useSettingsStore((s) => s.setPermissions)
  const voiceProfile = useVoiceProfileStore((s) => s.profile)
  const clearVoiceProfile = useVoiceProfileStore((s) => s.clearProfile)
  const [enrolling, setEnrolling] = useState(false)

  // Note: we only ever know WHETHER this device is linked. The pairing token
  // lives in the Electron main process, encrypted by the OS keystore, and is
  // never readable from here.
  const deviceLinked = useDeviceStore((s) => s.linked)
  const link = useDeviceStore((s) => s.link)
  const unlinkDevice = useDeviceStore((s) => s.unlink)
  const [tokenInput, setTokenInput] = useState('')
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [serverInput, setServerInput] = useState(apiOverride())
  const [serverMsg, setServerMsg] = useState<string | null>(null)

  const saveServer = () => {
    setApiBase(serverInput)
    setServerMsg(`Now talking to ${apiBase()}`)
  }

  const linkDevice = async () => {
    if (!tokenInput.trim()) return
    const stored = await link(tokenInput)
    setTokenInput('')
    if (!stored) {
      setLinkMsg({ ok: false, text: 'This system refused to store the token securely. Cannot link.' })
      return
    }

    const ok = await syncPolicyFromDashboard()
    if (ok) {
      // Push a local voiceprint up, or pull the account's down if this
      // device doesn't have one yet.
      if (useVoiceProfileStore.getState().profile) await uploadVoiceprint()
      else await ensureVoiceprint()
    } else {
      // A bad token is worse than none — don't leave it sitting there.
      await unlinkDevice()
    }

    setLinkMsg(
      ok
        ? { ok: true, text: 'Linked. Synced with your account.' }
        : { ok: false, text: 'Could not link. Check the token, and that the Senti server is reachable.' }
    )
  }

  const unlink = async () => {
    await unlinkDevice()
    setLinkMsg(null)
  }

  const handleReset = () => {
    const ok = window.confirm(
      'Reset this device? This clears the local voice profile and PIN and re-runs first-time setup.'
    )
    if (!ok) return
    clearVoiceProfile()
    resetConfiguration()
    close()
  }

  const sectionVariant = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0 },
  }

  const panel = (
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.45, ease: 'circOut' }}
      className="fixed top-0 right-0 h-full w-full md:w-96 z-50 p-6 flex flex-col gap-4 text-white"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="glass-strong p-4 rounded-lg flex items-center justify-between">
        <div>
          <div className="section-title text-lg">Control Center</div>
          <div className="section-sub">Senti — Settings</div>
        </div>
        <button onClick={close} className="px-3 py-1 rounded-md glass-hoverable">Close</button>
      </div>

      <div className="flex-1 overflow-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/40 scrollbar-track-slate-900/50">
        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Voice Unlock</h4>
          <p className="section-sub mb-3">Your voice unlocks Senti. Enroll or re-enroll here.</p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Voiceprint</div>
                <div className={`text-xs mt-1 ${voiceProfile ? 'text-green-400' : 'text-secondary'}`}>
                  {voiceProfile
                    ? `Enrolled — ${voiceProfile.sampleCount} samples`
                    : 'Not enrolled'}
                </div>
              </div>
              <div className="text-xs text-secondary">Primary</div>
            </div>
            {enrolling ? (
              <div className="mt-3">
                <VoiceEnrollment onComplete={() => setEnrolling(false)} />
                <button
                  onClick={() => setEnrolling(false)}
                  className="mt-3 rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setEnrolling(true)}
                  className="px-3 py-1 rounded-md bg-accent text-black text-xs glow-ring"
                >
                  {voiceProfile ? 'Re-enroll Voice' : 'Enroll Voice'}
                </button>
                {voiceProfile && (
                  <button
                    onClick={clearVoiceProfile}
                    className="px-3 py-1 rounded-md border border-red-400/30 text-red-300 text-xs hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
            <div className="font-semibold text-white">PIN Unlock</div>
            <div className="text-xs text-green-400">Configured · fallback</div>
          </div>
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">What Senti can do</h4>
          <p className="section-sub mb-3">
            Senti only ever does what you switch on here.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-white">Open apps and websites</div>
                <div className="mt-1 text-xs text-secondary">
                  Let Senti launch things when you ask — &ldquo;open Chrome&rdquo;.
                </div>
              </div>
              <button
                onClick={() => setPermissions({ openApps: !permissions.openApps })}
                aria-pressed={permissions.openApps}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  permissions.openApps ? 'bg-accent' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-black transition-all ${
                    permissions.openApps ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Account</h4>
          <p className="section-sub mb-3">
            Link this device to your Senti account so it follows your dashboard settings.
          </p>
          {deviceLinked ? (
            <div className="rounded-2xl border border-green-400/30 bg-green-500/10 p-4">
              <div className="flex items-center gap-2 text-sm text-green-300">
                <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
                Linked to your account
              </div>
              <button
                onClick={unlink}
                className="mt-3 px-3 py-1 rounded-md border border-white/10 text-xs text-white/70 hover:bg-white/5"
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste pairing token from dashboard"
                className="input-glass"
              />
              <button
                onClick={linkDevice}
                disabled={!tokenInput.trim()}
                className="px-3 py-2 rounded-md bg-accent text-black text-xs glow-ring disabled:opacity-50"
              >
                Link to account
              </button>
            </div>
          )}
          {linkMsg && (
            <div className={`mt-2 text-xs ${linkMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{linkMsg.text}</div>
          )}

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="text-xs uppercase tracking-[0.2em] text-secondary">Senti server</div>
            <p className="section-sub mb-2 mt-1">
              Where this device talks to. Leave blank to use the default ({apiBase()}).
            </p>
            <div className="grid gap-2">
              <input
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
                placeholder="https://your-senti.vercel.app"
                className="input-glass"
              />
              <button
                onClick={saveServer}
                className="px-3 py-2 rounded-md border border-white/10 text-xs text-white/80 hover:bg-white/5"
              >
                Save server
              </button>
            </div>
            {serverMsg && <div className="mt-2 text-xs text-green-400">{serverMsg}</div>}
          </div>
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Device</h4>
          <p className="section-sub mb-3">Re-provision this device from scratch.</p>
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-md border border-red-400/30 text-red-300 text-xs hover:bg-red-500/10"
          >
            Reset device &amp; re-run setup
          </button>
        </motion.section>
      </div>
    </motion.aside>
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={close}
          />
          {panel}
        </>
      )}
    </AnimatePresence>
  )
}
