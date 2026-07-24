import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../../state/uiStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useVoiceProfileStore } from '../../state/voiceProfileStore'
import { useDeviceStore } from '../../state/deviceStore'
import { useWakeStore } from '../../state/wakeStore'
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
  const lastHeard = useWakeStore((s) => s.lastHeard)
  const wakeStatus = useWakeStore((s) => s.status)
  const micLevel = useWakeStore((s) => s.micLevel)
  const setPermissions = useSettingsStore((s) => s.setPermissions)
  const requireSignIn = useSettingsStore((s) => s.requireSignIn)
  const setRequireSignIn = useSettingsStore((s) => s.setRequireSignIn)
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

  // What Senti remembers about you — loaded fresh whenever the panel opens.
  const [memories, setMemories] = useState<{ id: string; text: string; createdAt: number }[]>([])
  useEffect(() => {
    if (!open) return
    let alive = true
    window.senti
      ?.memoryList?.()
      .then((m) => alive && Array.isArray(m) && setMemories(m))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open])

  const forgetMemory = async (id: string) => {
    const m = await window.senti?.memoryForget?.(id)
    if (Array.isArray(m)) setMemories(m)
  }
  const clearAllMemories = async () => {
    if (!window.confirm('Make Senti forget everything it knows about you?')) return
    const m = await window.senti?.memoryClear?.()
    if (Array.isArray(m)) setMemories(m)
  }

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
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col text-white"
      style={{ pointerEvents: 'auto', background: 'radial-gradient(ellipse at 50% -10%, rgba(0,90,120,0.28), transparent 55%), #070a0e' }}
    >
      {/* Home header */}
      <div className="flex items-center justify-between border-b border-white/10 px-7 py-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-accent/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_rgba(0,212,255,0.9)]" />
          </span>
          <div>
            <div className="font-display text-lg font-semibold tracking-[0.14em] text-white">SENTI</div>
            <div className="text-[0.6rem] uppercase tracking-[0.3em] text-accent/80">Control Center</div>
          </div>
        </div>
        <button
          onClick={close}
          className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
        >
          Done
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-5 overflow-auto px-7 py-7 scrollbar-thin scrollbar-thumb-cyan-500/40 scrollbar-track-slate-900/50">
        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Your voice</h4>
          <p className="section-sub mb-3">Senti signs you in by your voice. Enroll or re-enroll here.</p>
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
            <div className="font-semibold text-white">PIN</div>
            <div className="text-xs text-green-400">Configured · fallback</div>
          </div>
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">What Senti can do</h4>
          <p className="section-sub mb-3">
            Senti only ever does what you switch on here.
          </p>
          <div className="grid gap-2">
            {([
              {
                key: 'alwaysListening',
                title: 'Talk to Senti anywhere',
                hint: 'Say its name, say hello, or press Ctrl+Shift+Space — then just talk, like a call. Listening happens only on this PC; audio is never uploaded.',
              },
              { key: 'openApps', title: 'Open apps and websites', hint: '“Open Chrome”, “pull up YouTube”.' },
              { key: 'systemControl', title: 'Volume and locking', hint: '“Turn it up”, “lock my PC”.' },
              { key: 'closeApps', title: 'Close running apps', hint: '“Close Chrome”. Off by default.' },
              { key: 'cleanup', title: 'Delete temporary files', hint: 'Frees disk space. Off by default.' },
            ] as const).map((p) => (
              <div key={p.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{p.title}</div>
                    <div className="mt-1 text-xs text-secondary">{p.hint}</div>
                  </div>
                  <button
                    onClick={() => setPermissions({ [p.key]: !permissions[p.key] })}
                    aria-pressed={permissions[p.key]}
                    aria-label={p.title}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      permissions[p.key] ? 'bg-accent' : 'bg-white/15'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-black transition-all ${
                        permissions[p.key] ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Proof it is actually hearing you — the answer to "it ignored me". */}
                {p.key === 'alwaysListening' && permissions.alwaysListening && (
                  <div className="mt-3 space-y-2 border-t border-white/5 pt-3 text-xs">
                    <div>
                      <span className="text-white/35">Status: </span>
                      <span className={wakeStatus === 'Listening.' ? 'text-green-400' : 'text-amber-300'}>
                        {wakeStatus}
                      </span>
                    </div>

                    {/* Talk and watch it move: separates a dead mic from a misheard name. */}
                    <div className="flex items-center gap-2">
                      <span className="text-white/35">Mic</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-100"
                          style={{ width: `${Math.round(micLevel * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-white/35">Last heard: </span>
                      <span className="text-white/70">
                        {lastHeard ? `“${lastHeard}”` : 'nothing yet — say something.'}
                      </span>
                    </div>

                    <div className="text-white/30">
                      Stays on this PC. If the bar moves but nothing lands here, it can hear
                      you and can&apos;t make out words. To start talking, say &ldquo;hey
                      Senti&rdquo; or just &ldquo;hello&rdquo;, give it an order like
                      &ldquo;open Chrome&rdquo;, or press Ctrl+Shift+Space — then keep
                      talking, no name needed. Say &ldquo;stop&rdquo; when you&apos;re done.
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="section-title">What Senti remembers</h4>
              <p className="section-sub">
                Facts it keeps about you, so it stops asking twice. Stored only on this PC.
              </p>
            </div>
            {memories.length > 0 && (
              <button
                onClick={clearAllMemories}
                className="shrink-0 rounded-full border border-red-400/30 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
              >
                Forget all
              </button>
            )}
          </div>
          {memories.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/45">
              Nothing yet. Tell Senti something about you or your setup — &ldquo;my main drive
              is D&rdquo;, &ldquo;I hate apps that auto-start&rdquo; — and it&apos;ll keep it.
            </div>
          ) : (
            <div className="grid gap-2">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span className="text-sm text-white/85">{m.text}</span>
                  <button
                    onClick={() => forgetMemory(m.id)}
                    className="shrink-0 text-xs text-white/40 hover:text-red-300"
                    aria-label="Forget this"
                  >
                    Forget
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section variants={sectionVariant} initial="hidden" animate="visible">
          <h4 className="section-title">Startup</h4>
          <p className="section-sub mb-3">How Senti behaves when your PC starts.</p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-white">Ask me to sign in each time</div>
                <div className="mt-1 text-xs text-secondary">
                  Off: Senti starts listening right away. On: it asks for your voice or PIN first.
                </div>
              </div>
              <button
                onClick={() => setRequireSignIn(!requireSignIn)}
                aria-pressed={requireSignIn}
                aria-label="Ask me to sign in each time"
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  requireSignIn ? 'bg-accent' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-black transition-all ${
                    requireSignIn ? 'left-6' : 'left-1'
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
    </motion.div>
  )

  return <AnimatePresence>{open && panel}</AnimatePresence>
}
