# Reddit post

Best fits: r/SideProject, r/coding, r/windows, r/programming (building-in-public
tone). Reddit punishes overclaiming hard, so this leads with what works and
names the limits out loud. That honesty is the strategy, not a disclaimer.

---

## Title options

- I'm building a voice-unlock + AI assistant layer for Windows — and I just
  started on the hard part: a real credential provider so it replaces the lock
  screen. Progress + architecture inside.
- My PC unlocks when it hears *my* voice (not a passphrase), then I can talk to
  it. Now writing the C++ to make it the actual Windows login, not a window on
  top. Building in public.
- Voice is the key: on-device speaker verification to unlock Windows, plus a
  talking assistant. Here's how it works, and the part I'm honest it can't do
  yet.

---

## Body

**What it is:** Senti is an AI layer for your PC. It learns your voice, so your
computer unlocks when it hears *you* — and no one else — and then you can just
talk to it and it answers out loud.

The part I'm proud of: **it verifies who is speaking, not what was said.** There
is no passphrase. Say anything — "hey", "open up", a sentence in another
language — and it unlocks on your voiceprint. A friend saying the exact same
words gets rejected.

**How it actually works:**
- Your voice → a neural net (WeSpeaker, ONNX) turns it into 256 numbers on your
  machine. That voiceprint, and your audio, never leave the device.
- Talk to it → Whisper transcribes locally, the text goes to an LLM (Llama on
  Groq by default, swappable to Grok/GPT/Gemini), the reply is spoken back in a
  real voice (ElevenLabs). ~0.5s to speak.
- A web dashboard is the source of truth; the desktop app obeys it. Device
  tokens are stored hashed, voiceprints encrypted at rest (they're biometrics —
  the one thing you can never rotate).

**Where I'm being honest — what it can't do yet:**
- Right now it's a full-screen lock that runs *after* Windows login, so
  **Ctrl+Alt+Del / Task Manager still get past it.** It's not the real lock
  screen yet.
- So this week I started the actual fix: a **C++ Windows credential provider**
  that runs at the real login screen, before you're in a session — where Task
  Manager can't touch it. The scaffold is up (ICredentialProvider +
  ICredentialProviderCredential, registers a Senti tile next to the password
  tile). Still stubbed: the KERB credential packing and the DPAPI-sealed vault.
  Building and testing it in a VM, because a bug there literally locks you out
  of your own machine.
- No liveness detection yet — a recording of your voice would currently pass.
- Installer isn't code-signed, so Windows shows "unknown publisher."

**The one thing I refuse to build:** silent always-on screen capture. Autostart
+ unbypassable lock + always-on capture + remote control + upload is the exact
fingerprint antivirus flags as malware — and I'm not putting other people's
screens on a database. Capture happens only on a *security event you can see*
(repeated failed unlocks), local-first.

**Roadmap:** choose your own AI model in the UI → control the machine by voice
(open apps, run tasks) → memory so it learns your context → phone/Telegram
remote control + "someone tried to unlock your PC" alerts → the credential
provider as the flagship → liveness.

Building in public. Repo, live demo, and the architecture write-up are linked
below. Brutal feedback welcome — especially from anyone who's shipped a
credential provider, because that's the part I most want to get right.

---

*Fill in before posting: repo link, the site (senti-kappa.vercel.app), and a
15–30s screen recording of a real voice unlock. The video does more than any
paragraph here — lead the comments with it.*
