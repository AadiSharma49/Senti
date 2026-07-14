# Reddit post — ready to publish

Primary: **r/SideProject** (supportive, building-in-public). Also good:
r/coding, r/programming, r/windows. Post the demo video FIRST — it does more
than any paragraph.

Reddit punishes hype and rewards honesty, so this leads with what works, names
every limit, and names the competitors before anyone else can. That's the
strategy, not a disclaimer.

---

## Title (pick one)

- I'm building a private, voice-controlled AI layer for Windows — it unlocks
  when it hears *my* voice, then I talk to it. Here's what actually works and
  what doesn't (building in public).
- My PC unlocks when it recognizes my voice (no passphrase), then I just talk to
  it. It's private and on-device. Honest progress + the hard part I just
  started.

---

## Body

For the last few weeks I've been building the computer I actually wanted: one I
run with my voice, that's **mine and private** — not Microsoft's, not the
cloud's. It's called Senti. Two things it does:

**1. It learns your voice and unlocks your PC when it hears you.** No passphrase.
It recognizes *who* is speaking, not *what* you say — so say anything at all, in
any language, and it unlocks. A friend saying the exact same words gets
rejected.

**2. Once you're in, you just talk to it.** It answers out loud in a real voice,
in any language, and it knows who it's talking to.

**How it works (for the technical folks):**
- Your voice → a neural net (WeSpeaker, ONNX) turns it into 256 numbers, on your
  machine. That voiceprint and your audio **never leave the device**.
- Talk to it → Whisper transcribes locally, only the *text* goes to an LLM
  (Llama on Groq by default — but you can swap to GPT / Gemini / Grok), and the
  reply is spoken back with ElevenLabs.
- Voiceprints are encrypted at rest, device tokens are stored hashed, and the
  backend rejects anything coming from a browser. I attacked my own API before I
  trusted it.

**What it CAN'T do yet — because I'm not going to sell anyone a lie:**
- Right now it's a full-screen lock that runs *after* Windows logs in, so
  **Ctrl+Alt+Del / Task Manager can still get past it.** It is not a real lock
  screen yet.
- I just started the actual fix: a C++ Windows **credential provider** that runs
  at the real login screen, where Task Manager can't touch it. Scaffold's done;
  the hard parts (and VM testing — a bug there locks you out of your own PC)
  aren't.
- No liveness detection — a recording of your voice would currently pass.
- Installer isn't code-signed yet, so Windows shows "unknown publisher."

**"Isn't this just ___?" — the honest answer:**
- **Windows Hello** does biometric unlock, but not voice, and it can't talk to
  you or run your machine.
- **Copilot** is in Windows now, but it's Microsoft's, cloud, tracks you, and
  you can't swap the model or make it verify it's really you.
- **Talon Voice** controls your PC by voice (great, command-driven, accessibility
  focus).
- The gap I'm going for: a private, on-device Jarvis that **you own**, where
  **you pick the AI model**, and **your voice is the key**.

**What I'm building next:** choose your own AI model in the app → control the
machine by voice (open apps, run tasks) → memory so it learns your context →
control it from your phone + "someone tried to unlock your PC" alerts → the real
credential-provider lock → liveness.

**The one thing I refuse to build:** silent always-on screen capture. Autostart
+ unbypassable lock + always-on recording + upload is literally the fingerprint
antivirus flags as malware, and I'm not putting anyone's screen on a server.
Capture only ever happens on a security event you can see.

It's early and rough, and I'm building it in the open. Repo + demo + site below.
I'd genuinely love brutal feedback — especially:
- Would you actually use this? The lock, the assistant, or both?
- Anyone here shipped a Windows credential provider? That's the piece I most
  want to get right.

[30-sec demo video] · [repo] · [site: senti-kappa.vercel.app]

---

## The 30-second demo to record (do this first)

1. Locked Senti screen. You lean in, say something ordinary — "alright, let's
   get to work." It unlocks and greets you by name. (~8s)
2. "That wasn't a password — watch." Say something totally different. Unlocks
   again. (~7s)
3. Ask it something real out loud; let the voice answer. (~10s)
4. End on the tagline or the orb. (~5s)

No narration needed — let it speak for itself. This clip is the post; the text
is the caption.
