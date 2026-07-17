# Reddit post — human version (copy the part below the line)

Post to r/SideProject first. Record the 30-sec demo and put it at the top —
the clip does the selling, this is just the story under it. Title options:

- I set out to build an AI voice lock screen. I ended up building something I
  think matters more. Here's the whole story.
- I almost shelved my project. Then I realized every AI agent has the same blind
  spot, and that's what I should've been building.
- My PC unlocks when it hears my voice — and that turned out to be the least
  interesting part.

--------------------------------------------------------------------------

I set out to build one thing and ended up with something different, and honestly
the change is the interesting part, so bear with me.

I wanted to replace my Windows lock screen with my voice. Walk up, say
something, it recognizes me and lets me in — no password, no fingerprint, just
talk. And I got it working. It turns your voice into a set of numbers right on
your machine, checks it's actually you, and unlocks. You can say anything, in
any language. My flatmate tried saying the exact sentence I use and it rejected
him — that was the moment it felt real. It's checking *who's* talking, not what
they say.

Then I kind of hit a wall. Because… a voice lock screen isn't that special, is
it? Windows Hello already unlocks your PC with your face, for free. And doing a
*truly* unbypassable lock means weeks of low-level Windows C++ that Microsoft
already does better than I ever could. I sat there thinking I'd built a worse
copy of something that already exists, and I almost shelved the whole thing.

What changed my mind was looking at where all of this is heading. Microsoft is
turning Windows into an "AI agent" platform now — agents that sit in your
system, run in the background, go through your files. Their own docs warn about
the risk, and one article literally called them "agents that pilfer through your
files." Copilot, Claude's Cowork, Manus — everyone's racing to hand an AI access
to your machine.

And it hit me: none of them actually know who they're talking to. They'll do
whatever anyone sitting at your keyboard tells them. And once these things can
delete files, spend money, run commands… "wait, who's actually allowed to tell
it to do that?" becomes kind of the whole ballgame. And nobody's answering it.

So that's what Senti is now. Not a lock screen — an AI that lives on your PC and
only listens to you.

The part I actually care about is the control. "An AI with access to my PC" is
terrifying. "An AI with exactly the access I chose to give it" is something you'd
actually install. So you hold the dial: give it nothing, or just let it read one
folder, or let it open apps, or let it act on its own while you're away — and it
can't quietly give itself more. On top of that it knows it's you (your voice,
checked on-device, the voiceprint never leaves your machine), and it lives where
your work is, so you can ask it about *this* file or *this* system instead of a
chat tab you paste your life into.

Right now what actually works is the voice unlock and a voice assistant you just
talk to — it answers out loud, any language, and knows who it's talking to. It's
Llama 4 on Groq under the hood but you can swap in GPT/Gemini/Grok. Speech-to-
text happens on your machine; only the text ever leaves.

Where I want to take it: asking about your own files and system ("is this worth
keeping?", "why's my PC slow?", "what should I upgrade?"), actually doing things
(open apps, clear junk, set up your morning), reaching it from your phone when
you're out, and eventually a real credential provider so it becomes the actual
login.

One thing I won't build: silent always-on screen recording. That's literally the
malware playbook and I'm not putting anyone's screen on a server. It sees what
you point it at, when you ask. That's it.

Being honest about what it can't do yet:
- It's a fullscreen lock that runs *after* Windows logs in, so Ctrl+Alt+Del
  still gets past it. The real C++ lock is started, not finished.
- No liveness detection, so a decent recording of my voice would probably fool
  it. Fair to roast me for that one.
- The assistant talks but doesn't actually *do* things on your machine yet.
- The installer isn't signed, so Windows will call it "unknown publisher."

And before someone says "isn't this just—": Windows Hello unlocks but can't talk
to you or check it's you by voice. Copilot/Cowork/Manus are powerful but cloud-
tied and none of them verify the human. There are some genuinely nice tools
(claude-remote-approver, claude-push) for approving agent prompts from your
phone — credit to them, I found them after I'd had the same idea — but they
solve approval, not identity.

Honestly, I don't know if I'm right that "the agent that knows it's you" is a
thing people want, or if I'm solving a problem nobody has yet. That's the actual
reason I'm posting before I build more.

So — would you install this? What access would you actually give an AI on your
machine? Is "it knows it's me" something you'd care about, or not? Genuinely,
tell me I'm wrong.

It's free, open, and rough:
https://github.com/AadiSharma49/Senti
https://senti-kappa.vercel.app

--------------------------------------------------------------------------

## The 30-second demo to record (this goes at the top of the post)

1. Locked screen. You say something ordinary — "alright, let's get to work." It
   unlocks and greets you by name.
2. "That wasn't a password — watch." Say something completely different. It
   unlocks again.
3. Someone else says the exact same sentence. Rejected. ← the money shot.
4. Ask it a real question; let the voice answer.

No narration. Let it speak for itself.
