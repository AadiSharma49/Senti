# Reddit launch post — ready to publish

**Primary: r/SideProject.** Then r/artificial, r/coding, r/LocalLLaMA (the
on-device angle plays hard there).

**Record the 30-second demo FIRST — the clip IS the post.** Script at the bottom.

Why this post is angled the way it is: Microsoft announced Windows agents at
Build 2026 (Agent Workspace, Agent Store, Fara-7B) — but it's still PRIVATE
PREVIEW, Insiders only, and their own docs say they're "adding more granular
security and privacy controls before general availability." Tom's Hardware's
headline was literally "agents that pilfer through your files." People are
already nervous. So we don't compete on "AI that controls your PC" (Microsoft
wins that). We lead with the thing none of them have: **it knows it's you.**

---

## Title (pick one)

- Microsoft is putting AI agents inside Windows with access to your files. I'm
  building the one that only listens to *me* — my voice is the key.
- Every AI agent will do what anyone sitting at your PC tells it. I built one
  that verifies it's actually you, by voice, on-device.
- My PC unlocks when it hears my voice — no passphrase — and then I just talk to
  it. Building the trust layer for PC agents, in public.

---

## Body

Microsoft is putting AI agents inside Windows — Agent Workspace, an Agent
Store, agents that run in the background with access to your personal folders.
It's still Insider-preview, and their own docs say they're still working out the
"security and privacy controls." One headline called it *"agents that pilfer
through your files."*

Here's the thing nobody's fixing: **none of these agents know who's talking to
them.** Copilot, Cowork, all of them — they'll take a command from anyone
sitting at your machine. And as agents get powerful enough to delete files,
spend money, and run commands, "who is allowed to tell it to?" stops being a
detail and becomes *the* question.

So I've been building **Senti**: an AI that lives on my PC, and only listens to
me.

**Two things work today:**

**1. My computer unlocks when it hears my voice.** No passphrase. It recognizes
*who is speaking*, not *what you say* — I can say literally anything, in any
language. My friend saying the exact same sentence gets rejected. (That's the
bit in the video.)

**2. I just talk to it.** It answers out loud in a real voice, any language, and
it knows who it's talking to. Not a chat window — it's on the machine.

**How it works (for the technical folks):**
- Voice → a neural net (WeSpeaker, ONNX) turns it into 256 numbers, **on my
  machine**. The voiceprint and the audio never leave the device.
- Speech → Whisper transcribes **locally**; only the text goes to the LLM
  (Llama 4 on Groq — swappable to GPT/Gemini/Grok with one env var).
- Reply → spoken back via ElevenLabs, ~0.5s.
- Voiceprints encrypted at rest, device tokens stored hashed, and the device API
  refuses any request that comes from a browser. I attacked my own backend
  before I trusted it.

## Why this isn't another agent wrapper

**It knows it's you.** Not a login you did once this morning — your voice, every
time. No other assistant verifies the human in the room.

**You hold the dial.** This is the whole design. "An AI with access to my PC" is
terrifying. "An AI with exactly the access I gave it" is something you'd
actually install. Nothing, or read one folder, or open apps, or act on its own
while you're out. You set it. It can't quietly widen it.

**It lives where your work is.** Not a tab you paste into. It's *on* the
machine — so you can ask about *this* file, *this* system, *this* screen,
instead of describing your computer to a chatbot that can't see it.

## Where it's going

- **Ask about your machine.** "Senti, is this file worth keeping?" "Why is my PC
  slow?" "What should I upgrade?" — real answers about *your* hardware, not
  generic advice.
- **It does things.** Open apps, clear the junk, set up your workspace the way
  you like it, every morning, automatically.
- **It's there while you work.** Stuck in a game or a task? Ask it what to do —
  it can look at what you point it at.
- **Reach it from anywhere.** You're out, your machine needs a decision, your
  phone buzzes, you approve. And if you don't reply, your trust dial decides.
- **The real lock.** A Windows credential provider so it becomes the login gate
  itself.

## What it CANNOT do yet — straight up

- It's a full-screen lock that runs **after** Windows logs in, so **Ctrl+Alt+Del
  and Task Manager still get past it.** It is *not* the real lock screen yet.
  The C++ credential provider is started, not finished.
- **No liveness detection** — a good recording of my voice would currently pass.
  (Working on it. Say so in the comments if you want to roast me for it, fair.)
- The assistant **talks; it doesn't act yet.** The doing-things part is next.
- No memory between sessions yet.
- Installer isn't code-signed → Windows says "unknown publisher."

## "Isn't this just ___?"

- **Windows Hello** — unlocks with face/fingerprint, but it's not voice, and it
  can't talk to you or touch your machine.
- **Copilot / Cowork / Manus** — powerful, but cloud-tied, you can't swap the
  model, and none of them check it's really you.
- **claude-remote-approver / claude-push** — genuinely good tools for approving
  agent prompts from your phone (credit where it's due — I found these after I
  had the same idea). They solve approval. They don't solve *identity*.
- **Voice biometrics vendors** (Sensory, etc.) — real tech, but it's aimed at
  call centers and banks. Nobody's welded it to a PC agent.

## The one thing I won't build

Silent always-on screen recording. Autostart + a lock + always-on capture +
remote control + upload is *literally* the behavior antivirus flags as a RAT,
and I'm not putting anyone's screen on a server. Senti sees what you point it
at, when you ask. The dial stays yours.

---

Early, rough, free, and open. Repo + site + demo below.

Genuinely want the brutal version:
- Would you install this? What access would you *actually* give it?
- Is "the agent knows it's me" something you'd care about — or am I solving a
  problem nobody has yet?
- Anyone shipped a Windows credential provider? That's the part I most want to
  get right.

[30-sec demo] · [repo] · [site]

---

## The 30-second demo (record this FIRST)

1. Locked screen. Say something ordinary — "alright, let's get to work." It
   unlocks and greets you by name. (~8s)
2. **"That wasn't a password — watch."** Say something completely different. It
   unlocks again. (~7s)
3. **A friend says the exact same sentence. Rejected.** ← this is the money
   shot, do not cut it (~8s)
4. Ask it a real question; let the voice answer. (~7s)

No narration. Let it speak for itself.
