# Reddit launch post — ready to publish

**Primary: r/SideProject.** Then r/coding, r/artificial, r/LocalLLaMA (the
on-device angle plays well there).

**Post the 30-second demo video FIRST.** The clip is the post; this text is the
caption. Without it, nothing here lands.

Two rules this post follows, and why:
1. It leads with what WORKS and clearly separates it from what's coming. A
   security/AI tool that overclaims gets executed in the comments.
2. It sells the **permission dial**, not "AI that sees everything." Same
   product, opposite reaction. "An AI with access to my PC" reads as malware;
   "an AI with exactly the access I gave it" reads as something people install.

---

## Title (pick one)

- I built an AI that lives on my PC, knows my voice, and only has the access I
  give it. It unlocks my computer when it hears me — then I just talk to it.
- My computer unlocks when it hears *my* voice (no passphrase), then I talk to
  it like a person. It's not a chat window — it lives on the machine. Building
  in public.
- Not another AI chat app: an assistant that lives on your PC, verifies it's
  really you by voice, and does what you permit — nothing more.

---

## Body

Every AI assistant right now is a **window you go to**. You open a tab, paste
your problem, copy the answer back. It doesn't know you, doesn't know your
machine, and forgets you the second you close it.

I wanted the opposite: something that **lives on my computer**, knows it's me,
and actually does things. So I've been building **Senti**.

**Two things work today:**

**1. My PC unlocks when it hears my voice.** No passphrase. It recognizes *who
is speaking*, not *what you say* — so I can say literally anything, in any
language, and it opens. A friend saying the exact same words gets rejected. The
voiceprint is computed on my machine and never leaves it.

**2. I just talk to it.** It answers out loud in a real voice, in any language,
and it knows who it's talking to. Not a chat box — a conversation.

**How it actually works (for the technical folks):**
- Voice → a neural net (WeSpeaker, ONNX) turns it into 256 numbers, locally.
  That voiceprint and the audio **never leave the device**.
- Speech → Whisper transcribes **on-device**; only the resulting text goes to
  the LLM (Llama 4 on Groq — swappable to GPT/Gemini/Grok with one env var).
- Reply → spoken back via ElevenLabs, ~0.5s.
- Voiceprints encrypted at rest, device tokens stored hashed, the device API
  refuses anything that comes from a browser. I attacked my own backend before
  I trusted it.

## Why this isn't "another agent wrapper"

Three things, and the third is the one I actually care about:

**It knows it's you.** Not a login — your *voice*. No other assistant verifies
the human in the room.

**It lives where your work is.** Not a tab. It's on the machine, at every
stage, so you can ask about *this file*, *this system*, *this screen* — instead
of describing your computer to a chatbot that can't see it.

**You hold the dial.** This is the whole design. An AI with access to your PC is
terrifying — so Senti only ever has the access *you* grant. Nothing, or read
this one folder, or open apps, or act on its own when you're away. You set it,
you change it, and it can't quietly widen it.

## Where it's going (the actual vision)

- **Ask about your machine.** "Senti, look at this file — is it worth keeping?"
  "Why is my PC slow?" "What should I upgrade?" It can see what you point it at.
- **It does things.** Open apps, run tasks, clear the junk, set up your
  workspace the way you like it every morning.
- **Reach it from anywhere.** This is the one I'm most excited about: you're out,
  your machine hits a decision — Claude Code asking "run this command, yes/no?"
  — **your phone buzzes, you tap approve, your machine keeps working.** And if
  you don't reply, it does what your trust dial says. Nobody has this.
- **It learns you.** Gets more useful the more you use it, instead of resetting
  every session.
- **The real lock.** A Windows credential provider so it becomes the actual
  login gate.

## What it CANNOT do yet — being straight

- It's a full-screen lock that runs **after** Windows logs in, so **Ctrl+Alt+Del
  and Task Manager still get past it.** It is not the real lock screen yet. The
  C++ credential provider that fixes that is started, not finished.
- **No liveness detection** — a good recording of your voice would currently
  pass.
- The assistant **talks, it doesn't act yet.** The doing-things part is next.
- **No memory between sessions** yet.
- Installer isn't code-signed, so Windows says "unknown publisher."

## "Isn't this just ___?"

- **Windows Hello** — biometric unlock, but not voice, and it can't talk to you
  or touch your machine.
- **Copilot** — it's Microsoft's, it's cloud, you can't swap the model, and it
  never verifies it's really you.
- **Talon Voice** — genuinely great for voice-driving a PC, but it's
  command-driven, not an assistant that knows you.

## One thing I refuse to build

Silent always-on screen recording. Autostart + a lock + always-on capture +
remote control + upload is *literally* the behavior profile antivirus flags as
a RAT — and I'm not putting anyone's screen on a server. Senti sees what you
point it at, when you ask. The dial is always yours.

---

It's early, rough, and free. Repo + site + demo below. I'd love brutal feedback:

- Would you install this? What access would you *actually* give it?
- If you run AI agents — would the "approve from your phone" thing be useful to
  you, or am I solving my own problem?
- Anyone shipped a Windows credential provider? That's the part I most want to
  get right.

[30-sec demo] · [repo] · [site]

---

## The 30-second demo to record FIRST

1. Locked screen. You say something ordinary — "alright, let's get to work." It
   unlocks and greets you by name. (~8s)
2. "That wasn't a password — watch." Say something completely different. Unlocks
   again. (~7s)
3. Ask it a real question out loud; let the voice answer. (~10s)
4. End on the orb. (~5s)

No narration. Let it speak for itself.
