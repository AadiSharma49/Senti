# Sentinel — where it is and where it's going

Written to be honest rather than promotional. Things that work are listed as
working; things that are rough are listed as rough.

---

## Built and working

**Voice.** Multi-turn conversation with memory, not one-off commands. Wakes on
its name, a greeting, a bare order ("open Chrome"), or `Ctrl+Shift+Space`.
Speech is recognised on-device by Whisper across ten languages. The voice
activity detector adapts to your microphone's level and your room's noise floor
so quiet microphones don't clip whole sentences down to a single syllable.

**Sixteen tools (15 local actions + live web search).** Opening apps, games, and
websites (focusing an already-open window instead of launching duplicates),
closing named apps or the active foreground app, showing the desktop, opening
folders, finding and opening files, visible or silent temp cleanup, emptying the
Recycle Bin, system volume, locking, sleep/restart/shutdown, screenshots,
on-demand screen Q&A, screen sharing, live web answers, and local memory. Every
action sits behind a unit-tested permission switch synchronized with the server
tool list.

**Seeing the screen — on request by default, opt-in background context.**
Saying *"help me with this"* grabs a single frame (`look_at_screen`) and answers
about it. Users who want continuous context can explicitly enable *"Watch my
screen in the background"* in Settings (`watchScreen`, off by default), which
samples downscaled stills every ~3s on change while showing a persistent red
stop badge.

**Knowing you.** A local `memories.json` file plus an aggregated local habits
journal (`activity.json`) that Sentinel reflects on every few hours to learn
what's durably true about how you use your PC.

**Speaking first.** Reads the foreground window title (never pixels) and
occasionally offers help when it detects the shape of being stuck — dwelling on
one window for a long stretch or repeatedly bouncing back to it.

**Your other devices & account security.** Live screen viewing, peer-to-peer
WebRTC remote control (1080p/720p60 presets, system audio, game mode with
relative mouse deltas, ordered input delivery, automatic stuck-key release, and
live receiver diagnostics), remote folder browsing, clipboard sync, remote
power commands, and full account controls (one-click sign-out across all browser
sessions + paired PCs, and permanent account deletion).

**189 unit tests + headless WebRTC loopback.** Covers wake parsing, action
permissions and server tool parity, main-process server-origin token pinning,
path containment, background vision timer/backoff invariants, WebRTC signaling
and frame fallback, ordered remote input and key release, adaptive VAD, and
memory recall — plus an automated two-peer Edge loopback suite
(`desktop/tests/loopback/run.mjs`).

---

## Rough edges, honestly

**Latency is the big one.** Several seconds for chat, ~8s to inspect a screen,
and ~11s for a live web answer because speech waits for full LLM + TTS
completion rather than streaming sentence-by-sentence.

**It can't be interrupted mid-sentence.** Talking over a person makes them stop;
Sentinel currently finishes playing its reply before listening for the next turn.

**Stock TTS voice by default.** Without a custom ElevenLabs voice ID configured,
projects on the default voice sound alike.

**Memory ranking is lexical, not semantic.** Keyword overlap matches *"drive"* to
*"drive"* but not *"disk"*. Semantic recall will require a small local embedding
model.

**Signaling and AI route through the cloud.** Two PCs on the same Wi-Fi stream
media peer-to-peer once connected, but still use the dashboard for pairing,
signaling, and cloud LLM/vision calls.

---

## Next, in order

1. **Streaming TTS & lower latency.** Begin speaking the first clause while the
   rest of the audio streams in.
2. **Barge-in interruption.** Cut playback immediately when the VAD detects the
   owner speaking over Sentinel.
3. **True local offline mode.** Properly sandboxed main-process IPC for local
   LLM/vision (Ollama) and local neural TTS, with real model health checks in
   Settings.
4. **Authenticated IDE integration.** An opt-in editor bridge with per-session
   mutual token authentication and explicit path/command approval prompts.
5. **LAN discovery & signaling.** Direct local-network pairing when both PCs are
   on the same Wi-Fi.
6. **Semantic memory.** On-device embeddings for meaning-based memory recall.

---

## Deliberately not building

**Silent, always-on background screen capture.** Hidden screen polling combined
with autostart and remote control behaves like spyware. Default screen access is
strictly single-frame on request, and the opt-in background watcher is off by
default and bound to a persistent red on-screen stop indicator whenever active.

**Camera access.** Same privacy boundary, with even less reason on a desktop PC.

**An unguarded "run arbitrary shell command" voice tool.** Letting a cloud model
emit raw PowerShell/cmd strings leaves the PC one hallucination or prompt
injection away from destructive commands. Actions remain a typed, whitelisted
set gated by local permissions.

**A custom video transport.** WebRTC already provides encrypted peer-to-peer
UDP, hardware codecs, and congestion control.

**Waking a powered-off PC.** Nothing is running on the host to receive a
command; powering on requires Wake-on-LAN in BIOS and router hardware.

---

## Known limits worth stating plainly

- **Fast twitch games over the internet won't feel native.** WebRTC across WANs
  adds 40–100ms; same-LAN sessions are much closer to local play.
- **Remote control needs the PC awake** and Sentinel running. Commands queued to
  a sleeping machine run once it wakes and polls.
- **Bare imperatives without the wake word are English-only.** Addressing
  Sentinel by name works across all ten supported languages.
- **Free-tier Gemini quotas vary by region/account.** Tavily + Groq serve as the
  primary web and vision path for reliability.
