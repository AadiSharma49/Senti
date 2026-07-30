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
import { onScreenShareChange, startScreenShare, stopScreenShare } from '../../services/screenShare'
import { listPeers, commandPeer, peerScreen, type PeerDevice } from '../../services/peers'
import { api } from '../../services/api'
import { AudioCapture } from '../../services/audioCapture'
import { reflect } from '../../services/reflection'
import { LANGUAGES, savedLang, setLang } from '../../services/greetingService'
import { getTurn, setTurn } from '../../services/webrtc'
import RemoteControlWindow from '../remote/RemoteControlWindow'
import RemoteFiles from '../remote/RemoteFiles'

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
  const voiceProfile = useVoiceProfileStore((s) => s.profile)
  const clearVoiceProfile = useVoiceProfileStore((s) => s.clearProfile)
  const [enrolling, setEnrolling] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  useEffect(() => onScreenShareChange(setScreenSharing), [])

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

  // Microphone choice. Windows' default input is frequently the wrong device,
  // and that — not the wake word — is usually why Senti "can't hear you".
  const [lang, setLangState] = useState(savedLang())
  const [micList, setMicList] = useState<{ id: string; label: string }[]>([])
  const [micId, setMicId] = useState(AudioCapture.preferredDeviceId())
  useEffect(() => {
    if (!open) return
    let alive = true
    void AudioCapture.listInputs().then((l) => alive && setMicList(l))
    return () => {
      alive = false
    }
  }, [open])

  const changeMic = async (id: string) => {
    setMicId(id)
    AudioCapture.setPreferredDeviceId(id)
    // Re-open the mic on the new device so the change takes effect now,
    // not on the next restart.
    const wake = useWakeStore.getState()
    if (wake.enabled) {
      wake.stop()
      await new Promise((r) => setTimeout(r, 300))
      void wake.start()
    }
  }

  // The PIN another device must enter to drive THIS machine. We only ever
  // learn whether one is set — never what it is.
  const [remotePinSet, setRemotePinSet] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  useEffect(() => {
    if (!open || !deviceLinked) return
    let alive = true
    void (async () => {
      const res = await api<{ set?: boolean }>('/api/device/remote/pin')
      if (alive && res.ok) setRemotePinSet(!!res.data?.set)
    })()
    return () => {
      alive = false
    }
  }, [open, deviceLinked])

  const saveRemotePin = async () => {
    const res = await api<{ ok?: boolean; error?: string }>('/api/device/remote/pin', {
      method: 'POST',
      body: { pin: pinInput },
    })
    setPinInput('')
    if (res.ok) {
      setRemotePinSet(true)
      setPinMsg('Remote PIN saved. Your other devices will need it to connect.')
    } else {
      setPinMsg(res.data?.error || "Couldn't save that PIN.")
    }
    setTimeout(() => setPinMsg(''), 6000)
  }

  const clearRemotePin = async () => {
    const res = await api('/api/device/remote/pin', { method: 'DELETE' })
    if (res.ok) {
      setRemotePinSet(false)
      setPinMsg('Remote control turned off for this PC.')
      setTimeout(() => setPinMsg(''), 6000)
    }
  }

  // Optional TURN relay for networks that block a direct peer connection.
  const [turnUrls, setTurnUrls] = useState(getTurn()?.urls ?? '')
  const [turnUser, setTurnUser] = useState(getTurn()?.username ?? '')
  const [turnPass, setTurnPass] = useState(getTurn()?.credential ?? '')
  const [turnMsg, setTurnMsg] = useState('')
  const saveTurn = () => {
    setTurn(turnUrls ? { urls: turnUrls, username: turnUser, credential: turnPass } : null)
    setTurnMsg(turnUrls ? 'Relay saved — it will be used on the next connection.' : 'Relay cleared.')
    setTimeout(() => setTurnMsg(''), 6000)
  }
  const clearTurn = () => {
    setTurn(null)
    setTurnUrls('')
    setTurnUser('')
    setTurnPass('')
    setTurnMsg('Relay cleared.')
    setTimeout(() => setTurnMsg(''), 6000)
  }

  // Which device we're driving right now (opens the control window).
  const [controlling, setControlling] = useState<{ id: string; name: string } | null>(null)

  // My Devices — every machine on this account, controllable from right here.
  const [peers, setPeers] = useState<PeerDevice[]>([])
  const [peerMsg, setPeerMsg] = useState<Record<string, string>>({})
  const [watchingId, setWatchingId] = useState<string | null>(null)
  const [browsingId, setBrowsingId] = useState<string | null>(null)
  const [watchFrame, setWatchFrame] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !deviceLinked) return
    let alive = true
    const poll = async () => {
      const list = await listPeers()
      if (alive) setPeers(list)
    }
    void poll()
    const t = setInterval(() => void poll(), 5000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [open, deviceLinked])

  // Watch a sibling's screen: pull its newest frame about as fast as it uploads.
  useEffect(() => {
    if (!open || !watchingId) {
      setWatchFrame(null)
      return
    }
    let alive = true
    const pull = async () => {
      const s = await peerScreen(watchingId)
      if (alive) setWatchFrame(s.frame)
    }
    void pull()
    const t = setInterval(() => void pull(), 1200)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [open, watchingId])

  const sendToPeer = async (
    d: PeerDevice,
    label: string,
    action: string,
    args?: Record<string, string | boolean>
  ) => {
    setPeerMsg((m) => ({ ...m, [d.id]: `Sending ${label}…` }))
    const ok = await commandPeer(d.id, action, args)
    setPeerMsg((m) => ({
      ...m,
      [d.id]: ok ? `${label} sent — ${d.name} will pick it up in a few seconds.` : `Couldn't send ${label}.`,
    }))
    setTimeout(() => setPeerMsg((m) => ({ ...m, [d.id]: '' })), 6000)
  }

  const forgetMemory = async (id: string) => {
    const m = await window.senti?.memoryForget?.(id)
    if (Array.isArray(m)) setMemories(m)
  }
  // Reflect on demand, so you can watch it learn instead of waiting hours.
  const [learning, setLearning] = useState(false)
  const [learnMsg, setLearnMsg] = useState('')
  const learnNow = async () => {
    setLearning(true)
    setLearnMsg('')
    try {
      const facts = await reflect(true)
      const m = await window.senti?.memoryList?.()
      if (Array.isArray(m)) setMemories(m)
      setLearnMsg(
        facts.length
          ? `Learned ${facts.length} new thing${facts.length === 1 ? '' : 's'} about you.`
          : "Nothing new yet — Senti needs more time watching how you work."
      )
    } catch {
      setLearnMsg("Couldn't reflect just now.")
    }
    setLearning(false)
    setTimeout(() => setLearnMsg(''), 8000)
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
              { key: 'files', title: 'Open files and folders', hint: '“Open my downloads”, “find my resume”. Opens them — never edits or deletes.' },
              { key: 'screenShare', title: 'Share screen to my devices', hint: 'Stream this PC live to your own phone/laptop. Shows a red badge while active.' },
              { key: 'clipboardSync', title: 'Sync clipboard between my devices', hint: 'Copy on this PC, paste on your laptop (and back). Text only — anything you copy syncs to your other Senti devices.' },
              { key: 'remoteControl', title: 'Allow remote control of this PC', hint: 'Let another of your devices drive this mouse and keyboard. Needs a remote PIN below. A banner shows the whole time, and you can stop it instantly.' },
              { key: 'proactive', title: 'Let Senti talk to me first', hint: 'It notices what you’re doing and speaks up now and then. Reads the window title only — never your screen — and stays quiet for long stretches.' },
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

                    {/* Which microphone. The usual cause of "it can't hear me"
                        is Windows defaulting to the wrong input entirely. */}
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-white/35">Input</span>
                      <select
                        value={micId}
                        onChange={(e) => void changeMic(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-accent/60"
                      >
                        <option value="">Windows default</option>
                        {micList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Speech is transcribed on-device and auto-detects the
                        language; this is which one Senti replies in. */}
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-white/35">Language</span>
                      <select
                        value={lang}
                        onChange={(e) => {
                          setLangState(e.target.value)
                          setLang(e.target.value)
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-accent/60"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.tag} value={l.tag}>
                            {l.label}
                          </option>
                        ))}
                      </select>
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

                {/* A real click here, so starting the stream never depends on
                    the OS honoring a request that came from voice or the phone. */}
                {p.key === 'screenShare' && permissions.screenShare && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <button
                      onClick={() => void (screenSharing ? stopScreenShare() : startScreenShare())}
                      className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition ${
                        screenSharing
                          ? 'border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          : 'border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                      }`}
                    >
                      {screenSharing ? 'Stop sharing' : 'Share my screen now'}
                    </button>
                    <div className="mt-2 text-xs text-white/30">
                      Starting it here always works. Starting it by voice or from your phone
                      usually does too, but Windows can occasionally require a direct click —
                      if that happens, tap this button instead.
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
                Facts it keeps about you, so it stops asking twice — some you told it, some it
                worked out from how you actually use this PC. All stored only on this machine.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => void learnNow()}
                className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent hover:bg-accent/20"
              >
                {learning ? 'Thinking…' : 'Learn from my habits'}
              </button>
              {memories.length > 0 && (
                <button
                  onClick={clearAllMemories}
                  className="rounded-full border border-red-400/30 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Forget all
                </button>
              )}
            </div>
          </div>
          {learnMsg && <div className="mb-2 text-xs text-accent">{learnMsg}</div>}
          {memories.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/45">
              Nothing yet. Tell Senti something about you or your setup — &ldquo;my main drive
              is D&rdquo;, &ldquo;I hate apps that auto-start&rdquo; — and it&apos;ll keep it.
              It also works this out on its own over time from how you actually use the PC.
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

        {deviceLinked && (
          <motion.section variants={sectionVariant} initial="hidden" animate="visible">
            <h4 className="section-title">My devices</h4>
            <p className="section-sub mb-3">
              Every machine on your account — watch and control them from right here. Install
              Senti on your laptop, link the same account, and it shows up too.
            </p>
            {peers.length <= 1 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/45">
                {peers.length === 0
                  ? 'Loading your devices…'
                  : 'Just this machine so far. Install Senti on another device and link the same account to control it from here.'}
              </div>
            ) : (
              <div className="grid gap-2">
                {peers.map((d) => {
                  const t = d.reportedAt || d.lastSeen
                  const live = !!t && Date.now() - new Date(t).getTime() < 90_000
                  return (
                    <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                live ? (d.status === 'working' ? 'bg-accent' : 'bg-green-400') : 'bg-white/25'
                              }`}
                            />
                            <span className="truncate font-semibold text-white">{d.name}</span>
                            <span className="text-xs text-white/35">{d.os}</span>
                            {d.self && (
                              <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-accent">
                                This PC
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate text-xs text-white/50">
                            {live ? d.activity || 'Idle' : 'Offline'}
                            {live && d.vitals ? ` · ${d.vitals}` : ''}
                          </div>
                        </div>
                      </div>

                      {!d.self && (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                            {([
                              { label: 'Lock', action: 'lock_workstation' },
                              { label: 'Sleep', action: 'power', args: { mode: 'sleep' } },
                              { label: 'Restart', action: 'power', args: { mode: 'restart' } },
                              { label: 'Shut down', action: 'power', args: { mode: 'shutdown' } },
                              { label: 'Clean up', action: 'clean_temp' },
                              {
                                label: 'Share screen',
                                action: 'screen_share',
                                args: { on: true },
                              },
                            ] as { label: string; action: string; args?: Record<string, string | boolean> }[]).map(
                              (s) => (
                                <button
                                  key={s.label}
                                  onClick={() => void sendToPeer(d, s.label, s.action, s.args)}
                                  disabled={!live}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    live
                                      ? 'border-white/15 bg-white/5 text-white hover:border-accent/40 hover:bg-accent/10'
                                      : 'cursor-not-allowed border-white/5 text-white/25'
                                  }`}
                                >
                                  {s.label}
                                </button>
                              )
                            )}
                            <button
                              onClick={() => setWatchingId(watchingId === d.id ? null : d.id)}
                              disabled={!live}
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                !live
                                  ? 'cursor-not-allowed border-white/5 text-white/25'
                                  : watchingId === d.id
                                  ? 'border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                  : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                              }`}
                            >
                              {watchingId === d.id ? 'Stop watching' : 'Watch screen'}
                            </button>
                            <button
                              onClick={() => setBrowsingId(browsingId === d.id ? null : d.id)}
                              disabled={!live}
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                !live
                                  ? 'cursor-not-allowed border-white/5 text-white/25'
                                  : browsingId === d.id
                                  ? 'border-accent/60 bg-accent/20 text-accent'
                                  : 'border-white/15 bg-white/5 text-white hover:border-accent/40 hover:bg-accent/10'
                              }`}
                            >
                              {browsingId === d.id ? 'Hide files' : 'Files'}
                            </button>
                            <button
                              onClick={() => setControlling({ id: d.id, name: d.name })}
                              disabled={!live}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                live
                                  ? 'border-accent bg-accent text-black hover:brightness-110'
                                  : 'cursor-not-allowed border-white/5 text-white/25'
                              }`}
                            >
                              Take control
                            </button>
                          </div>
                          {peerMsg[d.id] && <div className="mt-2 text-xs text-accent">{peerMsg[d.id]}</div>}
                          {browsingId === d.id && <RemoteFiles deviceId={d.id} deviceName={d.name} />}
                          {watchingId === d.id && (
                            <div className="mt-3">
                              {watchFrame ? (
                                <img
                                  src={watchFrame}
                                  alt={`${d.name} screen`}
                                  className="w-full rounded-lg border border-white/10"
                                />
                              ) : (
                                <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-white/30">
                                  Waiting for {d.name}&apos;s screen — tap &ldquo;Share screen&rdquo; first if
                                  it isn&apos;t streaming yet.
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* The PIN another device must enter to drive THIS machine. */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="font-semibold text-white">Remote PIN for this PC</div>
              <p className="mt-1 text-xs text-secondary">
                Both machines are already signed into your account — this PIN is the second
                lock, so a stolen laptop still can&apos;t drive this PC.{' '}
                {remotePinSet ? 'A PIN is set.' : 'No PIN set yet, so remote control is refused.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && pinInput.length >= 4 && void saveRemotePin()}
                  placeholder={remotePinSet ? 'New PIN' : 'Set a PIN (4-12)'}
                  className="w-40 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm tracking-widest outline-none focus:border-accent/60"
                />
                <button
                  onClick={() => void saveRemotePin()}
                  disabled={pinInput.length < 4}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    pinInput.length >= 4
                      ? 'bg-accent text-black hover:brightness-110'
                      : 'cursor-not-allowed border border-white/10 text-white/30'
                  }`}
                >
                  {remotePinSet ? 'Change PIN' : 'Set PIN'}
                </button>
                {remotePinSet && (
                  <button
                    onClick={() => void clearRemotePin()}
                    className="rounded-full border border-red-400/30 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Turn off remote control
                  </button>
                )}
              </div>
              {pinMsg && <div className="mt-2 text-xs text-accent">{pinMsg}</div>}
            </div>

            {/* TURN relay, for networks where a direct link can't form. */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="font-semibold text-white">TURN relay (optional)</div>
              <p className="mt-1 text-xs text-secondary">
                Remote control connects the two machines directly, which works on most home
                networks. Some networks won&apos;t allow it and it falls back to slow video —
                if that keeps happening, paste TURN credentials here to route around it.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  value={turnUrls}
                  onChange={(e) => setTurnUrls(e.target.value)}
                  placeholder="turn:host:3478"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs outline-none focus:border-accent/60"
                />
                <input
                  value={turnUser}
                  onChange={(e) => setTurnUser(e.target.value)}
                  placeholder="username"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs outline-none focus:border-accent/60"
                />
                <input
                  type="password"
                  value={turnPass}
                  onChange={(e) => setTurnPass(e.target.value)}
                  placeholder="credential"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs outline-none focus:border-accent/60"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveTurn}
                  className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-black hover:brightness-110"
                >
                  Save relay
                </button>
                {turnUrls && (
                  <button
                    onClick={clearTurn}
                    className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
              {turnMsg && <div className="mt-2 text-xs text-accent">{turnMsg}</div>}
            </div>
          </motion.section>
        )}

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

  return (
    <>
      <AnimatePresence>{open && panel}</AnimatePresence>
      {/* Driving another machine takes over the whole window. */}
      {controlling && (
        <RemoteControlWindow
          deviceId={controlling.id}
          deviceName={controlling.name}
          onClose={() => setControlling(null)}
        />
      )}
    </>
  )
}
