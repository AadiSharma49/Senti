# Senti — how it works, end to end

Senti has three parts. Each has a clear job, and a clear boundary about what
data crosses which line.

```
   ┌──────────────────────────────┐        ┌───────────────────────────┐
   │  YOUR WINDOWS PC             │        │  DASHBOARD (Vercel)       │
   │                              │        │                           │
   │  1. Credential provider      │        │  Next.js + Clerk          │
   │     (C++, login screen)      │        │  Postgres (Neon)          │
   │       │ voice / PIN          │        │                           │
   │       ▼                      │        │  - accounts, devices      │
   │  2. Desktop app (Electron)   │◄──────►│  - policy (source of      │
   │     - speaker verify (ONNX)  │  text  │    truth the PC obeys)    │
   │     - Whisper STT (ONNX)     │  only  │  - the AI brain + voice   │
   │     - the lock UI + assistant│        │  - security timeline      │
   │                              │        │                           │
   │  voiceprint + audio          │        │  device token: hashed     │
   │  NEVER leave this box  ──────┼────X   │  voiceprint: encrypted    │
   └──────────────────────────────┘        └───────────────────────────┘
                                       ▲
                                       │  (planned) phone / Telegram
                                       │  remote control + alerts
```

## 1. The lock (who gets in)

- **Today:** the Electron app is a full-screen lock *after* Windows login. It
  blocks Alt+Tab / Alt+F4, but Ctrl+Alt+Del and Task Manager get past it,
  because the Windows session is already unlocked underneath.
- **In progress (`credential-provider/`):** a C++ credential provider that runs
  at the real login screen, *before* the session exists. That is the version
  nothing walks past.

Either way, unlocking is **voice-first**: the WeSpeaker model turns your speech
into a 256-number voiceprint and compares it to your enrolled print. It checks
*who* is speaking, never *what* was said. A PIN is the always-available
fallback.

## 2. The assistant (what it can do)

You talk; Whisper transcribes **on your machine**; only the text is sent to the
brain (Llama on Groq by default, swappable to Grok/GPT/Gemini); the reply comes
back and is spoken in a real voice (ElevenLabs). Your audio never leaves the
device.

## 3. The dashboard (the source of truth)

Accounts, devices, and policy live here. The desktop is a secure endpoint that
*obeys* it. The device talks to it from a background process (not a browser),
authenticated by a device token.

## What crosses the boundary — the honest data model

This is the part that decides whether Senti is a security product or spyware.
The rule: **your machine is private by default.**

**Never leaves your PC:**
- Raw microphone audio.
- Your voiceprint in usable form (it is uploaded only *encrypted*, so it can
  sync to your other devices — the server cannot read it).
- Your Windows password (sealed with DPAPI, only ever on your machine).

**Leaves your PC, by design:**
- The *text* of what you say to the assistant (to reach the AI brain).
- Device status: name, OS, online/locked.

**Security events (the "capture" feature — done right):**
Senti does **not** silently record your screen or your day. It records only on
a **security event you can see**, and it is **local-first**:
- Triggers: repeated failed voice attempts, unlock from a new device, lockout.
- What's captured: a timestamp, the event type, the device — and optionally a
  single snapshot (webcam/screen) **of that moment only**.
- Where it goes: stored locally; a summary appears on your Security Timeline. A
  snapshot syncs to your account **only if you turn that on**.

Why not "capture everything"? Because always-on capture + autostart +
unbypassable lock + remote control + upload is the exact behavioral signature
antivirus flags as a RAT — and storing other people's screens (their passwords,
their bank pages) on a shared database is a breach waiting to happen. The
event-triggered version gives the same value ("someone tried to get in, here's
the moment, your phone buzzed") without becoming the thing it claims to protect
against.

## Roadmap position

| Piece | State |
| --- | --- |
| Voice unlock (on-device) | Done |
| Talking assistant | Done |
| Hardened backend, encrypted voiceprints | Done |
| Choose your AI model (in the UI) | Building |
| **C++ credential provider — the real lock** | **Scaffold in `credential-provider/`** |
| Control the machine by voice | Planned |
| Memory / RAG | Planned |
| Phone / Telegram remote + proactive alerts | Planned |
| Liveness (defeat voice replay) | Planned |
