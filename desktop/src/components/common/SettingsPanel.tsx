import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../../state/uiStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useVoiceProfileStore } from '../../state/voiceProfileStore'
import { useDeviceStore } from '../../state/deviceStore'
import { syncPolicyFromDashboard } from '../../services/policySync'

/**
 * Read-only Control Center. Per the platform design, the desktop is a
 * secure endpoint: it USES the configuration but does not edit it. Voice,
 * security mode and PIN are managed from the Senti dashboard (source of
 * truth) and synced down. A device reset is offered only to re-provision.
 */
export default function SettingsPanel() {
  const open = useUiStore((s) => s.settingsOpen)
  const close = useUiStore((s) => s.closeSettings)

  const resetConfiguration = useSettingsStore((s) => s.resetConfiguration)
  const voiceProfile = useVoiceProfileStore((s) => s.profile)
  const securityMode = useVoiceProfileStore((s) => s.securityMode)
  const clearVoiceProfile = useVoiceProfileStore((s) => s.clearProfile)

  const deviceToken = useDeviceStore((s) => s.token)
  const setToken = useDeviceStore((s) => s.setToken)
  const clearToken = useDeviceStore((s) => s.clearToken)
  const [tokenInput, setTokenInput] = useState('')
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const linkDevice = async () => {
    if (!tokenInput.trim()) return
    setToken(tokenInput)
    setTokenInput('')
    const ok = await syncPolicyFromDashboard()
    setLinkMsg(
      ok
        ? { ok: true, text: 'Linked. Policy synced from your account.' }
        : { ok: false, text: 'Could not reach the dashboard. Check the token and that the dashboard is running.' }
    )
  }

  const unlink = () => {
    clearToken()
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

  const modeLabel = securityMode === 'voice_only' ? 'Voice only' : 'Phrase + Voice'

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
          <div className="section-sub">This device · read-only</div>
        </div>
        <button onClick={close} className="px-3 py-1 rounded-md glass-hoverable">Close</button>
      </div>

      <div className="glass rounded-2xl p-4 text-sm text-white/70">
        Settings are managed from your{' '}
        <span className="text-accent">Senti dashboard</span> and synced to this device.
        Senti is a secure endpoint — it can&apos;t be edited here.
      </div>

      <div className="flex-1 overflow-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/40 scrollbar-track-slate-900/50">
        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Unlock Methods</h4>
          <p className="section-sub mb-3">Voice is the primary unlock. PIN is the emergency fallback.</p>
          <div className="grid gap-3">
            <ReadonlyRow
              title="Voice Unlock"
              tag="Primary"
              status={voiceProfile ? 'Enrolled' : 'Not enrolled'}
              ok={!!voiceProfile}
              detail={
                voiceProfile
                  ? `${voiceProfile.sampleCount} samples · ${new Date(voiceProfile.createdAt).toLocaleDateString()}`
                  : undefined
              }
            />
            <ReadonlyRow title="Security Mode" tag="Policy" status={modeLabel} ok />
            <ReadonlyRow title="PIN Unlock" tag="Fallback" status="Configured" ok />
          </div>
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Account</h4>
          <p className="section-sub mb-3">
            Link this device to your Senti account so it follows your dashboard settings.
          </p>
          {deviceToken ? (
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

function ReadonlyRow({
  title,
  tag,
  status,
  ok,
  detail,
}: {
  title: string
  tag: string
  status: string
  ok: boolean
  detail?: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-white">{title}</div>
          <div className={`text-xs mt-1 ${ok ? 'text-green-400' : 'text-secondary'}`}>{status}</div>
          {detail && <div className="text-xs text-secondary mt-0.5">{detail}</div>}
        </div>
        <div className="text-xs text-secondary">{tag}</div>
      </div>
    </div>
  )
}
