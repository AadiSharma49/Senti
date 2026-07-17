# Reddit launch post — the story version

**Primary: r/SideProject.** Then r/artificial, r/coding, r/LocalLLaMA.
**Record the 30-sec demo FIRST — the clip IS the post** (script at bottom).

This version tells the real story: what I set out to build, why I changed my
mind, and what it is now. Story posts outperform feature lists on Reddit because
people root for the person, not the product. Every limit is named so nobody can
dunk. It credits the tools I found after the fact. It's honest that I might be
wrong — which is the thing that actually gets real feedback.

---

## Title (pick one)

- I spent months building an AI voice lock screen. Then I realized I was
  building the wrong thing. Here's what it became.
- Every AI agent will do what anyone sitting at your PC tells it. I built one
  that checks it's actually you — by your voice. Here's the whole story.
- I almost quit my project. Then Microsoft announced something that made me
  realize what I should've been building all along.

---

## Body

I want to tell the whole story, because the thing I set out to build and the
thing I ended up with are different — and the change is the interesting part.

**Where I started.** I wanted to replace the Windows lock screen with my voice.
Walk up, say something, it recognizes *me* and unlocks. No password, no
fingerprint — just my voice. And I got it working: it turns your voice into 256
numbers **on your own machine**, checks it's you, and unlocks. You can say
anything, in any language. A friend saying the exact same words? Rejected. It
knows *who* is speaking, not *what* was said.

**Then I hit a wall.** A lock screen… isn't special. Windows Hello already
unlocks your PC with your face, for free, built in. And a truly unbypassable
lock needs weeks of low-level C++ that Microsoft already does better than I ever
will. I was building a worse copy of something that exists. I almost shelved the
whole thing.

**Then Microsoft handed me the answer.** At Build 2026 they announced Windows is
becoming an "AI agent OS" — agents that live in your system, run in the
background, with access to your files. Their own docs warn about the security
risk. One headline literally called it *"agents that pilfer through your
files."* Copilot, Claude's Cowork, Manus — everyone's racing to give AI access
to your machine.

And it clicked: **not one of them knows who's talking to it.**

They'll take a command from anyone sitting at your keyboard. And once an AI can
delete your files, spend your money, and run commands — *"who is allowed to tell
it to?"* becomes the most important question there is. Nobody's answering it.

So that's what Senti is now. Not a lock screen. **The AI that lives on your PC
and only listens to you.**

- **It knows it's you** — your voice, every time, verified on-device. The
  voiceprint never leaves your machine.
- **You hold the dial** — it only ever has the access you give it. Nothing, or
  read one folder, or open apps, or act on its own while you're out. "An AI with
  access to my PC" is terrifying. "An AI with exactly the access I gave it" is
  something you'd actually install. That dial is the whole product.
- **It lives where your work is** — ask it about *this* file, *this* system,
  *this* screen. Not a chat tab you paste your life into.

**What works today:** voice unlock, and a real voice assistant you just talk to —
it answers out loud, in any language, and knows who it's talking to. (Llama 4
on Groq, swappable to GPT/Gemini/Grok. Whisper does the speech-to-text
on-device; only text ever leaves.)

**Where it's going:** ask about your files and system ("is this worth keeping?",
"why is my PC slow?", "what should I upgrade?"), it does things (open apps, clear
junk, set up your morning workspace), reach it from your phone when you're out,
and eventually the real credential-provider lock.

**What I refuse to build:** silent always-on screen recording. That's the exact
behavior antivirus flags as malware, and I'm not putting your screen on a
server. It sees what you point it at, when you ask. The dial stays yours.

**Being straight about the limits:**
- It's a full-screen lock that runs *after* Windows login, so **Ctrl+Alt+Del
  still gets past it.** The real C++ lock is started, not finished.
- No liveness detection yet — a good recording of my voice would pass. Roast me
  for it, it's fair.
- The assistant talks; it doesn't *act* yet. That's next.
- Installer isn't code-signed, so Windows says "unknown publisher."

**"Isn't this just ___?"** Windows Hello unlocks but can't talk to you or check
it's you by voice. Copilot/Cowork/Manus are powerful but cloud-tied and don't
verify the human. There are great tools (claude-remote-approver, claude-push)
for approving agent prompts from your phone — credit to them, I found them after
having the same idea; they solve *approval*, not *identity*.

---

Honestly? I don't know if I'm right that "the agent that knows it's you" is the
thing people want, or if I'm solving a problem nobody has yet. That's exactly why
I'm posting *before* building more.

- Would you install this? What access would you actually give an AI on your PC?
- Is "it knows it's me" something you'd care about — or not?
- Tell me I'm wrong.

Free, open, rough. [demo] · [repo] · [site]

---

## The 30-second demo (record FIRST)

1. Locked screen. Say something ordinary — "alright, let's get to work." It
   unlocks and greets you by name. (~8s)
2. **"That wasn't a password — watch."** Say something completely different. It
   unlocks again. (~7s)
3. **A friend says the exact same sentence → rejected.** This is the money shot.
   Do not cut it. (~8s)
4. Ask a real question; let the voice answer. (~7s)

No narration. Let it speak for itself.
