# Sentinel — how it works, end to end

The desktop, its optional local VS Code extension, and the dashboard share one rule: **everything that acts on a
machine happens on that machine**, behind its own local permissions. The server
manages accounts, authenticates devices, runs cloud LLM/TTS/vision calls, and
relays signaling or queued commands.

```
   ┌────────────────────────────────┐        ┌──────────────────────────┐
   │  YOUR PC — desktop app         │        │  DASHBOARD (Vercel)      │
   │  Electron 30 + React 18        │        │  Next.js 14 + Clerk      │
   │                                │        │  Postgres (Neon)         │
   │  • Whisper STT      (on-device)│◄──────►│                          │
   │  • 15 local actions            │  HTTPS │  • accounts & sessions   │
   │  • screen vision (on-demand    │  pinned│  • device API (SHA-256)  │
   │    by default; 3s watch opt-in)│  origin│  • LLM, TTS, web, vision │
   │  • memory + habits  (local)    │        │  • WebRTC signaling      │
   │  • WebRTC remote host/viewer   │        │  • web status/screen UI  │
   │                                │        │                          │
   │  raw audio NEVER leaves ───────┼───X    │  no raw audio, ever      │
   └────────────────────────────────┘        └──────────────────────────┘
              ▲                                        ▲
              │  WebRTC: video + ordered input         │  Clerk-authed web UI
              │  peer-to-peer (or user TURN)           │  (devices, live screen,
              ▼                                        │   queued commands,
   ┌────────────────────────────────┐                  │   account security)
   │  YOUR OTHER PC                 │──────────────────┘
   └────────────────────────────────┘
```

## The desktop app

**Hearing you.** The microphone feeds a voice-activity detector whose threshold
tracks the room's noise floor — a fixed cutoff meant quiet microphones only
registered their loudest syllable, so sentences arrived as fragments. Speech
segments go to Whisper running locally in WebAssembly. Raw audio never leaves
the machine. Sentinel uses the standard OS cursor and runs as a small floating
orb HUD plus a full Control Center window.

**Deciding it was addressed.** `wakeParse` decides whether you were talking to
Sentinel: its name, a greeting, or a bare imperative ("open Chrome") all count;
background chatter doesn't. Once engaged, a multi-turn conversation stays open
until idle timeout or an explicit stop phrase ("stop", "never mind").

**Doing things.** The base `/api/device/chat` toolset includes **15 client-side
actions** (`open_app`, `close_app`, `close_current`, `show_desktop`,
`open_folder`, `open_file`, `clean_temp`, `empty_recycle_bin`, `screen_share`,
`take_screenshot`, `look_at_screen`, `lock_workstation`, `power`, `set_volume`,
and `remember`) plus **1 server-answered tool** (`ask_web`). Every client action
maps through `actionPermissions.ts`, and `actionPermissions.test.ts` parses both
`actions.ts` and `dashboard/app/api/device/chat/route.ts` so no tool can ever
drift out of sync or bypass its permission switch. Unknown actions fail shut,
and there is no arbitrary shell-execution tool.

**Editor commands.** Eight additional tools target the paired VS Code workspace.
`open_editor_file(path)` uses the editor's `open_file` command; it does not replace
Windows `open_file(query)`. Electron main owns the opt-in `127.0.0.1:9876`
listener. VS Code and Sentinel prove possession of a separate random 256-bit
pairing key with role-specific HMACs over two fresh nonces before a command can
run. The key is stored using Electron safeStorage and VS Code SecretStorage.
Loopback binding alone is not authentication. Only one authenticated window is
served at a time. Requests have IDs, deadlines and bounded replies; a disconnect
is reported as a failure, not retried as a second write. `run_tests` selects a
workspace test task with local approval and returns its exit status; the model
cannot supply a terminal command. See [setup and limits](vscode-extension/README.md).

**Server-pinned token isolation.** The device pairing token is stored in
`userData/device.token` encrypted via Electron `safeStorage` (Windows DPAPI).
Renderer JavaScript can never read the token; it invokes `senti:api` in main.
`apiGuard.ts` normalizes and pins the server origin in `userData/server.json`,
rejects any renderer call whose `baseUrl` or path deviates from the configured
origin and `/api/device/*`, whitelists the HTTP verb (GET/POST/PATCH/DELETE),
and fails shut on redirects (`redirect: 'error'`) so a pinned URL can never
forward the bearer token to another host. Changing the configured server
requires a native main-process confirmation dialog the renderer cannot click,
and automatically clears any stored token when the origin changes.

**Seeing.** Screen access is split into two explicit switches:
- `seeScreen` (**on by default**): powers one-shot `take_screenshot` and
  `look_at_screen` ONLY when you ask. Nothing runs on a timer.
- `watchScreen` (**off by default**): opt-in 3-second background screen context
  (`screenContext.ts`). When enabled alongside `seeScreen`, it samples downscaled
  stills only when the frame changes, backs off exponentially (`6s` up to `60s`)
  on errors without double-arming timers, pauses automatically while hidden or
  during remote control, and keeps a red **`Watching screen · stop`** pill on
  screen the entire time.

**Knowing you.** Durable facts live in `userData/memories.json`. An aggregated
activity journal (`activity.json` — app, day, rough time-of-day, minutes) lets
Sentinel reflect every few hours without recording timestamped window titles.

## The dashboard

Accounts, device pairing, the cloud AI endpoints, and the web dashboard:
- **Browser routes** are gated by Clerk (`middleware.ts`). Users can pair/unlink
  devices, watch a live screen feed, queue whitelisted remote commands (which
  the target PC still checks against its own local permissions), sign out all
  devices (atomically unlinking all paired PCs and revoking all active Clerk
  sessions), or permanently delete their account (`POST`/`DELETE /api/account`).
- **Device routes (`/api/device/*`)** are called from Electron's main process
  (Node), so legitimate requests carry no `Origin` header; any request with an
  `Origin` header is rejected with `403`. Tokens are stored as SHA-256 hashes
  and rate-limited in isolated per-capability buckets (`chat`, `vision`,
  `policy`, `stream`, `rtcSignal`, `remoteInput`, `remoteSession`, `frameWrite`,
  `frameRead`, `reject`) so high-rate streams or vision checks never starve
  signaling or voice chat.

## Remote control

A session requires a one-time emailed code (when Resend is configured) or a
static remote PIN set on the target PC. Until verified, input is rejected.

Once verified, single-owner generation-tagged WebRTC signaling (`webrtc.ts`)
connects the two PCs peer-to-peer (or via user-configured TURN), buffering early
ICE candidates until remote description settles. Video and audio ride media
tracks (with HTTP JPEG fallback only while RTC is disconnected), and mouse/key
events ride an ordered reliable data channel (falling back to sequenced HTTP
delivery).

Injected input runs through a single long-lived PowerShell Win32 injector in
Electron main (`remoteKeyboard.ts` + `drainInjector.ts`), tracking held virtual
keys and releasing every held key automatically when a session ends or times out
so keys can never stick on the host. Input rows queued in Postgres are deleted
immediately upon delivery.

## What crosses the boundary

**Never leaves your PC:** raw microphone audio, your full `memories.json` file,
your `activity.json` habits journal, and the raw device token after pairing.

**Leaves by design:** transcribed text once you engage Sentinel, top relevant
memory snippets for prompt context, device status/vitals, one screenshot when
you invoke `look_at_screen` (or downscaled stills every ~3s only if you opt into
`watchScreen`), and screen video/stills while sharing or under verified remote
control. Images are never persisted beyond the single live `ScreenFrame` slot
used during active screen sharing.

## Safety-critical code, and why it's tested

| Suite | What it guards |
| --- | --- |
| `wakeParse.test.ts` | Wake/dismiss detection across greetings, names, imperatives, and noise |
| `actionPermissions.test.ts` | Permission gating + 1-to-1 sync between `actions.ts` and server `TOOLS` |
| `apiGuard.test.ts` | Main-process server-origin pinning, traversal blocking, and token clear on server change |
| `pathSafety.test.ts` | Directory containment and symlink/UNC/traversal rejection for remote file browsing |
| `screenContext.test.ts` | Default-off background vision, single-timer invariant, exponential backoff, and `{ context }` parsing |
| `webrtc.test.ts`, `remoteHost.test.ts`, `remoteFrames.test.ts`, `remoteHeartbeat.test.ts`, `remoteVideoStats.test.ts` | Generation-isolated WebRTC signaling, early ICE buffering, frame pacing, and session liveness |
| `inputDelivery.test.ts`, `remoteKeyboard.test.ts` | Sequenced input ordering, coalescing, and stuck-key release |
| `vadThreshold.test.ts`, `audioNormalize.test.ts` | Adaptive noise-floor speech cutoff and quiet-mic gain normalization |
| `memoryRecall.test.ts`, `stuckSignal.test.ts` | Lexical memory ranking and dwell/revisit stuck detection |

```bash
cd desktop && npm test               # Vitest, including live socket authentication tests
cd vscode-extension && npm run test:host  # Real VS Code extension host, isolated profile + workspace
cd desktop && npm run test:loopback  # Two-peer headless Edge WebRTC loopback
```
