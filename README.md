# Sentinel

A voice assistant that lives on your Windows PC and actually operates it. Not a browser chatbot — an OS-level co-pilot that hears your voice locally, acts within explicit permissions, remembers your habits on-device, and lets you reach your other PCs over peer-to-peer WebRTC.

---

## What it can do

**Talk, properly.** Say its name, say hello, give it an order, or press `Ctrl+Shift+Space`. Then keep talking — it's a multi-turn conversation with memory, not a one-shot command line. Say *"stop"* when you're done. Supports ten languages; speech recognition runs on-device via Whisper.

**Run your machine.** Sentinel has 15 desktop actions and server-side live web search. Pairing VS Code adds eight editor tools:

| Category | Actions |
|---|---|
| Apps | `open_app` (installed apps, games, websites; focuses if already open), `close_app`, `close_current` (active foreground app) |
| Desktop & System | `show_desktop`, `set_volume` (up / down / mute), `lock_workstation`, `power` (sleep / restart / shutdown) |
| Files | `open_folder` (Downloads, Documents, Desktop, etc.), `open_file` (search user folders by name) |
| Cleanup | `clean_temp` (visibly in Explorer or silently), `empty_recycle_bin` |
| Screen | `take_screenshot` (saved to `Pictures/Senti`), `look_at_screen` (one-shot vision Q&A), `screen_share` (stream to your devices) |
| Knowledge & Memory | `ask_web` (live web lookup on the server), `remember` (durable facts saved locally) |
| Paired VS Code workspace | `get_active_file`, `read_file`, `write_file`, `list_files`, `open_editor_file`, `get_diagnostics`, `get_git_status`, `run_tests` |

**Use VS Code by voice.** [Install and pair the extension](vscode-extension/README.md), then try *“Sentinel, read my active file”* or *“Sentinel, run my tests.”* The first reads the editor buffer, including unsaved edits. The second asks you to approve a workspace **Test** task in VS Code and reports how it exited; it cannot type arbitrary commands into a terminal. Writes also require approval. The editor connection stays on this PC and is separate from dashboard device pairing.

Every machine action maps through a tested permission table (`desktop/src/services/actionPermissions.ts`), and Sentinel refuses out loud when a switch is off. There is no arbitrary shell-command tool by design.

**See your screen — on request by default, or opt-in background context.**
- **On request (default):** *"Help me with this"* or *"What does this error mean?"* grabs a single frame at the moment you ask (`look_at_screen`) and never stores it.
- **Background context (opt-in, off by default):** Enable *"Watch my screen in the background"* in Settings if you want Sentinel to sample downscaled frames every ~3 seconds when the screen changes. A red **`Watching screen · stop`** badge stays visible the entire time capture is open, and clicking it stops capture immediately.

**Remote control.** Drive another linked PC over WebRTC. After the email code or device PIN check, the session header reports the selected path (direct or TURN), negotiated codec, received resolution, decoded frame rate, and round-trip time. Hover over it for bitrate, drops, and freezes. `HTTP JPEG fallback` means low-rate stills, **not** TURN video. Try **720p60 — smoothest** for motion or **1080p30 — balanced** for text; presets are ceilings, not guaranteed frame rates.

Update the dashboard and **both** desktop apps together: the two peers use the same generation-tagged signaling format. For test measurements, fault injection, and reproduction commands, see [the two-peer loopback test](desktop/tests/loopback/README.md).

**Know you.** Facts you tell it live in a local JSON file (`memories.json`). It also keeps an aggregated local activity journal — app, day, time bucket, minutes — so it can reflect on durable habits without logging timestamped window titles.

**Speak first.** When allowed, Sentinel reads the foreground window title (never pixels) and occasionally offers help if you look stuck on one window or keep bouncing back to it.

**Manage your devices & account.** Pair devices, watch live screens, queue whitelisted remote commands, browse user folders across linked PCs, opt in to clipboard sync, revoke all active web sessions + device tokens at once, or delete your account from the web dashboard.

---

## Privacy & Security

- **On-device STT:** Microphone audio is processed locally by an adaptive voice-activity detector and Whisper. Raw audio is never uploaded.
- **Pinned credential boundary:** Pairing tokens are encrypted on disk via OS keystore (`safeStorage` / DPAPI) in the Electron main process, never exposed to renderer JS, and outbound `/api/device/*` requests are pinned to the configured server origin (`desktop/electron/apiGuard.ts`). Changing the server URL automatically unlinks any previous server's token.
- **Browser-proof device API:** `/api/device/*` rejects any request carrying an `Origin` header, hashes tokens with SHA-256 at rest, and rate-limits chat, vision, signaling, frames, and auth failures in separate buckets.
- **Visible capture & control:** Screen sharing, opt-in background screen watching, and remote mouse/keyboard control each display a persistent on-screen indicator/banner with one-click local stop.
- **Local memory:** `memories.json` and the aggregated habits journal stay on your PC; only top relevant facts are attached as text context during chat.
- **No camera access and no arbitrary shell execution.** The editor can run only a test task that you select and approve in VS Code, not a command supplied by the model. Sentinel uses the standard OS cursor and never hides it.

---

## Layout

```
desktop/    Electron 30 + React 18 — voice HUD, Control Center, OS actions, WebRTC remote control
dashboard/  Next.js 14 + Clerk + Prisma (Neon Postgres) — accounts, device API, web remote view
shared/     Versioned editor action names and argument validation (used by dashboard and desktop)
vscode-extension/  Optional VS Code extension — authenticated local workspace commands
```

Actions run on the target PC, either in the desktop app or its paired VS Code extension. The dashboard does not execute editor commands.

---

## Running it

```bash
cd dashboard && npm install && npm run dev   # Next.js backend & web dashboard
cd desktop   && npm install && npm run dev   # Electron desktop app
```

`dashboard/.env` needs `DATABASE_URL`, `DIRECT_URL`, Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`), and `GROQ_API_KEY`. Optional providers degrade gracefully:

| Key | Gives you | Without it |
|---|---|---|
| `ELEVENLABS_API_KEY` | natural neural TTS voice | falls back to the system/browser voice |
| `TAVILY_API_KEY` | live web search answers | tells you it can't reach the web rather than guessing |
| `RESEND_API_KEY` | emailed one-time codes for remote control | falls back to the target PC's static remote PIN |
| `GEMINI_API_KEY` | secondary web grounding & vision fallback | Groq handles chat and vision |

### Tests & Packaging

```bash
cd desktop && npm test                    # Vitest (permissions, bridge, voice, remote control)
cd vscode-extension && npm run test:host  # Installed VS Code, Node 24+, git; run npm ci in desktop and vscode-extension first
cd desktop && npm run test:loopback       # Headless Edge two-peer WebRTC + input loopback
cd desktop && npm run build               # Type-check & bundle renderer + Electron main/preload
cd desktop && npm run dist                # Build desktop/release/Sentinel-Setup.exe
cd dashboard && npm run build             # Prisma generate + Next.js production build
```

---

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system boundaries, security model, and tested invariants
- [ROADMAP.md](ROADMAP.md) — what's built, current rough edges, what's next, and what won't be built
