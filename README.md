# Senti v0.1.0 — first public build

**Your voice is the key. And the assistant is listening.**

Senti locks your computer and unlocks it when it hears *you* — not a password,
not a phrase, your actual voice. Then you keep talking, and it answers out loud
like an assistant that knows who you are.

This is the first build you can install and run. It is early, and the "Known
limits" section below is deliberately honest — read it before you rely on it.

---

## What it does

- **Voice unlock, no passphrase.** Walk up, say anything at all — "hey", "open
  up", a sentence in any language — and Senti unlocks if it recognizes your
  voice. It verifies *who is speaking*, not *what was said*. Say the wrong thing
  in the wrong voice and it stays locked.
- **A talking assistant.** Once you're in, just talk to Senti. It answers out
  loud in a real human voice, in any language, and it knows your name.
- **Fully private verification.** Your voice is turned into 256 numbers on your
  own machine. That voiceprint, and your audio, never leave the device.
- **PIN fallback.** A 4-digit PIN is always there for when your voice can't be.
- **One account, every device.** Enroll once; your voiceprint follows you to
  your other machines. Manage everything from the web dashboard.

## How it works, briefly

- **Who is speaking** → WeSpeaker ResNet34-LM, running offline in the app.
- **What you said** → Whisper (multilingual), transcribed on-device.
- **Thinking** → Llama 3.3 70B on Groq (swappable to Grok / OpenAI / Gemini by
  one setting).
- **Speaking** → ElevenLabs, a real human voice in about half a second.
- **The dashboard** → Next.js + Postgres. It's the source of truth; the desktop
  app obeys it.

## Security

Each of these was tested by actually attacking it:

- The device API rejects any request that comes from a web page (no CORS
  surface at all) — a malicious site gets a 403.
- Your device key lives in a background process, encrypted by Windows itself.
  The visible app can't read it back, even with dev tools open.
- The database stores only a one-way hash of each device key — a leak yields no
  usable credentials.
- Voiceprints are encrypted at rest (AES-256-GCM). This is biometric data — the
  one credential you can never change.
- Every request is rate limited.

## Install

1. Download `Senti-Setup-0.1.0.exe` below.
2. Windows will say "unknown publisher" (this build isn't code-signed yet) —
   choose **More info → Run anyway**.
3. Senti opens into setup. It asks for a **pairing token first** — get one from
   your dashboard under **Devices → Link a device**.
4. Set a PIN, then read the five short enrollment lines.
5. Done. It locks. Speak, and you're in.

Requirements: Windows 10 or 11, 64-bit. ~250 MB — it's large because the speech
and speaker models ship inside it, so verification needs no internet.

## Known limits (read this)

- **It is not the Windows login screen.** It's a full-screen app that locks the
  desktop and blocks Alt+Tab / Alt+F4 — but **Ctrl+Alt+Del and Task Manager
  still get past it.** Truly replacing the login screen needs a signed Windows
  credential provider, which is the big item on the roadmap.
- **Unsigned installer.** Windows SmartScreen will warn until it's code-signed.
- **No liveness detection.** A high-quality recording of your voice could
  currently pass. Don't use this as your only defense on a sensitive machine.
- **The assistant talks, it doesn't act yet.** It can't open apps or control
  your system — that's coming.
- **No memory between sessions.** It forgets the conversation when the window
  closes.
- **Web search isn't live** on the default (Groq) brain. Switch to Gemini for
  grounded, current answers.

---

## Roadmap

Rough order, honestly labeled by effort.

### Next
- **Proactive alerts + remote control (Telegram).** Someone fails voice unlock
  on your machine → your phone buzzes. Lock your PC, check status, and control
  it from anywhere. This also makes the Security Timeline real.
- **Event capture, done right.** On a *security event* (repeated failed
  attempts), grab a snapshot of that moment — local-first, never a background
  surveillance uploader.
- **Pick your voice.** Choose the assistant's voice and persona from the
  dashboard.

### Soon
- **Memory (RAG).** Senti remembers you between sessions — your preferences,
  your context — and gets more useful the more you use it. A weekly digest of
  what mattered.
- **Do things, not just say things.** A tool-using assistant that can open apps,
  run tasks, and act on your machine when you ask.
- **Liveness detection.** Defeat replay attacks — reject a recording of your
  voice.

### Big
- **The real Windows lock screen.** A signed C++ credential provider so Senti
  survives Ctrl+Alt+Del and genuinely replaces the login screen. Weeks of work,
  built in a VM, and needs a code-signing certificate — but it's the thing that
  turns "a secure app" into "your lock screen."
- **macOS and Linux.**

### For everyone else
- **Make it yours.** Voice, persona, unlock strictness, and rules — all
  customizable per account, so Senti feels like *your* assistant, not a fixed
  one.

---

*Built in public. Feedback and issues welcome.*
