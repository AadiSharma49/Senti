# Sentinel

A voice assistant that lives on your Windows PC and actually operates it. Not a chatbot — an OS agent that sees your screen, hears your voice, controls your apps, and builds things alongside you.

---

## What it can do

**Talk, properly.** Say its name, say hello, give it an order, or press `Ctrl+Shift+Space`. Then keep talking — it's a conversation with memory, not a command line. Say *"stop"* when you're done. Ten languages; speech is recognised on-device.

**Run your machine.** Everything it can do:

| Category | Actions |
|---|---|
| Apps | open any installed app or game, **close any running app by voice**, switch to one already running |
| Files | open folders, find and open a file by name |
| Cleanup | clear temp files (visibly, on screen), empty the recycle bin |
| System | volume, lock, sleep, restart, shut down |
| Screen | take a screenshot, **look at your screen and help with what's on it** |
| Code | read/write files, run terminal commands, list folders, get editor diagnostics, build projects |
| Knowledge | answer from the live web |
| Memory | remember a fact about you |

Every one sits behind a switch you control, and it refuses out loud when one is off.

**See your screen — continuously.** A background watcher captures your screen every 3 seconds, sends it to a vision model, and builds a live context model of what you're doing. Sentinel knows you're coding in VS Code or playing a game without you saying anything. When a game is detected, it pauses automatically to save CPU/GPU.

**Build things with you.** Say *"build a chat app"* and Sentinel opens VS Code, reads your project structure, writes the code, runs the server, and tells you what's happening. It has a VS Code bridge that gives it real-time access to your editor, terminal, and diagnostics.

**Remote control — AnyDesk-level smooth.** Full mouse-and-keyboard control of another device over WebRTC. Game mode sends relative mouse deltas at 120Hz with zero batching for instant key presses. Direct peer connection for sub-16ms latency; HTTP fallback if P2P fails. Cursor uses the real system cursor — no artificial overlays.

**Know you.** Facts you tell it live in a local file. It also works out your habits on its own — which apps, when, for how long — and answers about the real you rather than in generalities.

**Speak first.** It notices what you're doing and occasionally says something unprompted. If you've been stuck on one thing for a long stretch, or keep bouncing back to it, it offers to help with that specific thing.

**Reach your other devices.** Watch this PC live, take full mouse-and-keyboard control, browse and fetch its files, share a clipboard both ways. Remote control needs a code emailed to you or a PIN you set.

**Local AI mode — zero cloud.** Toggle it in Settings. All AI runs on your machine via Ollama (LLM + vision) and Piper (TTS). No audio, no screen data, no code ever leaves the PC. Models used: qwen2.5-coder:14b for chat, llava:7b for vision.

---

## Privacy, concretely

- Speech-to-text runs **on-device**. Audio is never uploaded.
- Only the **text** of what you say reaches the assistant, and only once you've addressed it.
- Memory and the habits journal are **local files** that never leave the machine.
- Screenshots happen **only on request** and are never retained.
- Remote control shows an unmissable banner the whole time and can be killed instantly from the machine being controlled.
- **Local mode** runs everything — LLM, vision, TTS — on your machine. Zero cloud calls, zero data leaves the PC.
- There is **no continuous screen recording and no camera**. Deliberately.

---

## Layout

```
desktop/    Electron + React — the assistant, voice, OS actions, remote control
dashboard/  Next.js — accounts, the device API, and a read-only web view
vscode-extension/  VS Code extension — code bridge for Sentinel
```

Everything that acts on a machine happens in the desktop app on that machine, behind its own permissions. The web dashboard is a window, not a control panel.

---

## Running it

```bash
cd dashboard && npm install && npm run dev   # backend
cd desktop   && npm install && npm run dev   # app
```

`dashboard/.env` needs `DATABASE_URL`, Clerk keys, and `GROQ_API_KEY`. The rest are optional and degrade rather than break:

| Key | Gives you | Without it |
|---|---|---|
| `ELEVENLABS_API_KEY` | a human voice | the browser's built-in voice |
| `TAVILY_API_KEY` | live web answers | it says so instead of guessing |
| `RESEND_API_KEY` | emailed codes for remote control | falls back to a device PIN |
| `GEMINI_API_KEY` | a second web/vision provider | Groq handles both |

For **local mode** (no cloud AI), install and start Ollama:
```bash
# Install Ollama from https://ollama.ai
ollama pull qwen2.5-coder:14b
ollama pull llava:7b
```

Then toggle **Local Mode** in Sentinel Settings.

```bash
cd desktop && npm test      # 138 unit tests
cd desktop && npm run dist  # build the installer
```

---

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit and where the trust boundaries are
- [ROADMAP.md](ROADMAP.md) — what's built, what's next, and what won't be built

---

## Current Status

- **Desktop app**: Electron 30 + React 18, fully functional
- **Remote control**: WebRTC peer connection + HTTP fallback, game mode, 120Hz input
- **Screen understanding**: Continuous background watcher with vision model
- **VS Code bridge**: WebSocket server + extension for code operations
- **Local AI**: Ollama integration (qwen2.5-coder:14b + llava:7b), Piper TTS
- **Tests**: 138/138 passing, zero TypeScript errors
- **Installer**: `E:\Senti\desktop\release\Sentinel-Setup.exe`
