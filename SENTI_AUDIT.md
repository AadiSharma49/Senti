# Senti — Full Project Audit & Handoff

**Purpose of this file:** hand it to any fresh AI context (Claude web, a new
chat, a collaborator) and it will understand Senti completely — what it is,
what's built, what works, what's broken, what's next, and how to run it. Kept
honest: "works" means verified, "planned" means not built.

_Last updated: 2026-07-18. Repo: github.com/AadiSharma49/Senti · Live:
https://senti-kappa.vercel.app · 84 commits, branch `main`._

---

## 1. What Senti is (the one-paragraph version)

Senti is **the AI that lives on your PC and only listens to you.** Your voice is
the key — it verifies *who is speaking* (not a password, not a phrase) entirely
on your own machine, and unlocks. Then you talk to it and it answers out loud.
The product bet: as AI agents get access to people's computers (Microsoft is
pushing exactly this), **none of them know who's talking to them** — Senti does,
and it only ever has the access you grant it (a permission "dial"). Identity
first, access on a dial.

**It is NOT** primarily a lock screen (Windows Hello already does biometric
unlock). The lock is the hook; the product is **an identity-gated, permission-
controlled AI agent for your machine.**

---

## 2. Architecture — three parts

```
  YOUR WINDOWS PC                          CLOUD (Vercel + Neon)
  ┌────────────────────────────┐          ┌──────────────────────────┐
  │ desktop/  (Electron app)   │  text    │ dashboard/ (Next.js)     │
  │  - lock screen + voice     │◄────────►│  - accounts (Clerk)      │
  │  - on-device voiceprint    │  only    │  - devices, policy       │
  │  - on-device speech→text   │          │  - the LLM brain + TTS   │
  │  - the voice assistant     │          │  - Postgres (Neon)       │
  │  - talks to backend from   │          │                          │
  │    the MAIN process only   │          │ device token: hashed     │
  │  voiceprint + audio        │          │ voiceprint: encrypted    │
  │  NEVER leave the machine   │──X───────│ at rest (AES-256-GCM)    │
  └────────────────────────────┘          └──────────────────────────┘

  credential-provider/  (C++)  — SCAFFOLD ONLY, not built/shipped
    the future "real" Windows login-screen lock (survives Ctrl+Alt+Del)
```

- **desktop/** — Electron 30 + React 18 + TypeScript + Vite. ~5,000 lines. The
  app the user installs. Fullscreen lock, voice unlock, assistant.
- **dashboard/** — Next.js 14 (App Router) + Clerk + Prisma + Postgres. ~2,700
  lines. Accounts, device management, and it hosts the AI brain + voice so keys
  never touch the desktop. Deployed on Vercel, DB on Neon.
- **credential-provider/** — C++ COM DLL (~530 lines). A *scaffold* for the real
  Windows credential provider. Does not compile-to-shipping yet; two files
  stubbed. This is the "unbypassable lock" future, and it's weeks of VM work.

---

## 3. Tech stack (exact)

| Layer | Tech |
| --- | --- |
| Desktop shell | Electron 30, Vite 5, React 18, TypeScript, Zustand, framer-motion |
| Speaker verification (WHO) | WeSpeaker ResNet34-LM, ONNX, via @huggingface/transformers + onnxruntime-web (WASM), **on-device** |
| Speech-to-text (WHAT) | Whisper tiny (multilingual), ONNX, **on-device** |
| LLM brain | Groq → `meta-llama/llama-4-scout-17b-16e-instruct`. Swappable via env to Grok / OpenAI / Gemini (see `dashboard/lib/llm.ts`) |
| Voice (TTS) | ElevenLabs (`eleven_turbo_v2_5`), voice "Chris" (`iP95p4xoKVk53GoZ742B`), free premade. Falls back to browser TTS |
| Dashboard | Next.js 14 App Router, Tailwind |
| Auth | Clerk v5 (test keys currently) |
| DB / ORM | Neon Postgres + Prisma 6 |
| Hosting | Vercel (dashboard), GitHub Releases (installer, ~250 MB) |
| Future lock | C++ credential provider (Win32 COM), not built |

---

## 4. What WORKS today (verified this session)

- **Voice unlock, installed app.** Text-independent — say anything, it verifies
  your voiceprint locally and unlocks. Verified working after fixing the mic +
  model-load bugs.
- **The voice assistant.** Tap, talk, it transcribes on-device, sends text to
  Groq (Llama 4), speaks the reply via ElevenLabs. Voice-only UI (no transcript
  text). Verified end-to-end.
- **Multi-monitor lock.** Every non-primary display is blanked ("Locked by
  Senti") until unlock. Fixed the fullscreen-on-wrong-monitor bug.
- **Windowed first-run setup** (not a fullscreen trap).
- **Persistence** — set up once, it remembers you (was broken by a random-port
  bug; now a fixed port 47615 keeps localStorage stable).
- **Accounts + device pairing.** Sign up (Clerk) → dashboard → Devices → link a
  device → paste one-time token into the desktop → linked. Multi-user, isolated.
- **Hardened backend.** Verified by attacking it: browser origin → 403, no
  token → 401, bad token → 401 + rate-limited, no CORS wildcard, security
  headers present.
- **Secrets at rest.** Device tokens stored as SHA-256 hashes; voiceprints
  AES-256-GCM encrypted (refuses to store unencrypted).
- **Live deployment.** senti-kappa.vercel.app returns 200; Neon connected.
- **Public download page** at `/download` (no login wall).

---

## 5. What's BUILT but incomplete / needs the user

- **Installer on GitHub Releases is an OLD build.** The fully-fixed
  `desktop/release/Senti-Setup.exe` exists locally but must be **uploaded to the
  GitHub "Software" release** so downloaders get the working version.
- **Latest code not always pushed.** `git push` needed for Vercel to redeploy
  the reworked landing page + fixes.
- **Clerk is on TEST keys.** Works, but shows a dev banner and has limits. Needs
  a Clerk **production instance** (needs a domain) before real scale.
- **Model picker** — the brain is swappable in code (env), but users can't pick
  it in the dashboard UI yet.

---

## 6. What's PLANNED (not built — the roadmap)

In priority order (agreed direction):

1. **System awareness (read-only).** "Senti, why is my PC slow?" / "is this file
   worth keeping?" — answering about the user's ACTUAL machine (RAM, disk,
   processes, startup apps). This is the smallest thing that makes it "worth it"
   vs ChatGPT, and it's days of work. **Strong candidate for next.**
2. **Remote co-pilot loop.** Telegram → phone controls the PC → "something needs
   you" pings (e.g. approve an agent's action from anywhere) → the trust dial.
   This is the differentiated vision. Note: phone-approval for Claude Code
   already exists (claude-remote-approver etc.) — Senti's angle is *identity +
   dial*, not just approval.
3. **It does things.** Tool-using agent: open apps, run tasks, clear junk, set up
   a workspace. The permission dial gates this.
4. **Memory / RAG.** Remembers the user between sessions; weekly digest.
5. **The real C++ credential provider.** Survives Ctrl+Alt+Del. Weeks, VM-only,
   needs code-signing cert for distribution.
6. **Liveness detection** (defeat voice-recording replay).

---

## 7. HONEST limitations (say these out loud; don't hide them)

- **Not the real Windows lock yet.** It's a fullscreen app that runs AFTER
  Windows login, so **Ctrl+Alt+Del / Task Manager still get past it.** Only the
  C++ credential provider fixes this. No Electron trick can.
- **No liveness detection** — a good recording of the owner's voice would pass.
- **Assistant talks but doesn't act** on the machine yet.
- **Installer unsigned** — Windows SmartScreen says "unknown publisher."
- **Won't build:** silent always-on screen capture. It's the malware behavioral
  profile and a privacy/legal landmine. Capture is event-triggered + local-first
  only.

---

## 8. Deployment & config

- **Live site:** https://senti-kappa.vercel.app (Vercel, root dir = `dashboard`)
- **DB:** Neon Postgres. `DATABASE_URL` must keep `?pgbouncer=true` (pooled);
  `DIRECT_URL` (unpooled) is for migrations.
- **Installer:** `desktop/release/Senti-Setup.exe` (~250 MB — ships the models).
  Served from GitHub Releases (too big for Vercel/git).
- **Desktop → backend URL** is baked at build via `VITE_SENTI_API_URL`
  (currently `https://senti-kappa.vercel.app`); a user can override in Settings.

**Env vars (all in `dashboard/.env`, and must be set on Vercel):**
`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`,
`NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`,
`NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`, `GROQ_API_KEY`,
`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, **`SENTI_ENCRYPTION_KEY`**
(CRITICAL — same value everywhere, or enrolled voiceprints become unreadable).

There is ONE env file: `dashboard/.env` (Next.js AND Prisma both read it).
`npm run check:env` validates every key against its real API.

---

## 9. How to run everything

```bash
# Dashboard (localhost:3000)
cd dashboard
npm install
npm run dev
npm run check:env      # validate all API keys
npm run db:studio      # browse the DB (localhost:5555)
npm run db:migrate     # apply migrations to Neon

# Desktop (dev, hot reload)
cd desktop
npm install
npm run setup:voice    # one-time: downloads the ONNX models into public/models
npm run dev

# Desktop (build the installer)
cd desktop
npm run dist           # -> release/Senti-Setup.exe
```

**Gotchas learned the hard way (do not repeat):**
- Don't run `next build` while `npm run dev` is running — corrupts `.next`
  (`Cannot find module './510.js'`). Fix: `rm -rf .next`.
- Don't leave a stray dev server on :3000 — the desktop points at it.
- The desktop `.exe` serves itself over a FIXED local port (47615) so
  localStorage (PIN, voiceprint, setup flag) persists across launches. A random
  port makes the app forget the user every boot.
- Models load from `/models/...`; the packaged app serves them over local HTTP
  (not file://) or they 404.

---

## 10. Data model (Prisma / Neon)

- **User** — id (Clerk id), email, name. Created on first dashboard visit
  (`lib/user.ts ensureUser()`), so a new signup never hits a foreign-key error.
- **Device** — belongs to User. `tokenHash` (SHA-256 of the pairing token, never
  raw), name, os, status, voiceEnrolled, linked, lastSeen.
- **VoiceProfile** — belongs to User. `embedding` (encrypted JSON), sampleCount,
  modelId. Biometric — encrypted at rest.
- **Policy** — belongs to User. voiceThreshold, maxAttempts, lockoutDuration.
  (Unlock is voice-only; the old "wake phrase / security mode" was removed.)
- **UnlockEvent** — the security timeline (type, detail, device, time).

---

## 11. Key files (where things live)

**Desktop (`desktop/src/`)**
- `services/voiceEmbeddingEngine.ts` — WeSpeaker voiceprint (256-dim) + cosine.
- `services/speechRecognition.ts` — Whisper on-device transcription.
- `services/audioCapture.ts`, `voiceActivityDetector.ts`, `utteranceRecorder.ts`
  — the mic → speech-segment pipeline (configurable max length + silence).
- `services/api.ts` — the ONLY path to the backend; calls go through Electron
  main so the device token never touches renderer JS.
- `services/assistantService.ts` / `state/assistantStore.ts` — the voice agent.
- `state/voiceAuthStore.ts` — click-to-listen unlock (verify voiceprint).
- `state/voiceProfileStore.ts` — enrolled voiceprint (localStorage).
- `components/lockscreen/` — LockScreen, UnlockPanel.
- `components/onboarding/` — AccountStep (token first), SetupWizard,
  VoiceEnrollment (5 varied lines → text-independent print).
- `electron/main.ts` — window, lock hardening, multi-monitor covers, static
  server, encrypted token vault (safeStorage/DPAPI), mic permission, backend
  proxy. **The security-critical file.**

**Dashboard (`dashboard/`)**
- `lib/llm.ts` — provider-agnostic brain router (Groq default).
- `lib/tts.ts` — ElevenLabs voice.
- `lib/deviceAuth.ts` — the device-API gate (no CORS, rejects browser origins,
  rate limits, hashed-token lookup).
- `lib/crypto.ts` — token hashing + voiceprint encryption.
- `lib/user.ts` — ensureUser (fixes the new-user FK crash).
- `app/api/device/*` — chat, greeting, policy, voiceprint, link (token-authed).
- `app/page.tsx` — the landing page (identity-first).
- `app/download/page.tsx` — public download.

**C++ (`credential-provider/src/`)** — SentiProvider / SentiCredential / Dll +
Guid/Common. Compiles to a registerable tile; `Serialization.cpp` (KERB cred
packing) and `SentiVault.cpp` (DPAPI PIN+password) are STUBBED. See
`credential-provider/README.md`.

---

## 12. The decision the user is at now

Senti works (voice unlock + assistant) and is deployed. Zero real users yet. The
open question is **what to build next**, and the honest answer is: **ship the
demo, get ~10 real reactions, let them decide** — rather than guess. The launch
post is written (`REDDIT.md`), positioned as: *"every AI agent will do what
anyone tells it; mine only listens to me."*

If building before feedback, the highest-leverage next feature is **#1 system
awareness** (answering about the user's real machine) — it's the smallest thing
that makes Senti clearly worth more than ChatGPT, and it proves the "lives on
your PC" claim in one sentence.

**Immediate to-dos that only the user can do:** (1) upload the fixed
`Senti-Setup.exe` to the GitHub release, (2) `git push` so Vercel redeploys, (3)
record the 30-sec demo (with the "friend says the same words → rejected" shot),
(4) post it.
```
