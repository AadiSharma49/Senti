# Senti

A voice assistant that lives on your Windows PC and actually operates it.

You talk to it like a person — *"open Chrome"*, *"clean up my temp files"*,
*"what's the weather"*, *"help me with this"* — and it does the thing and
answers out loud. Speech is transcribed **on your machine**; your audio never
leaves it.

From any of your own devices you can watch this PC's screen, take real
mouse-and-keyboard control of it, browse its files, and share a clipboard.

---

## What it can do

**Talk, properly.** Say its name, say hello, give it an order, or press
`Ctrl+Shift+Space`. Then keep talking — it's a conversation with memory, not a
command line. Say *"stop"* when you're done. Ten languages; speech is
recognised on-device.

**Run your machine.** Fourteen things it can do:

| | |
|---|---|
| Apps | open any installed app or game, close apps, switch to one already running |
| Files | open folders, find and open a file by name |
| Cleanup | clear temp files (visibly, on screen), empty the recycle bin |
| System | volume, lock, sleep, restart, shut down |
| Screen | take a screenshot, **look at your screen and help with what's on it** |
| Knowledge | answer from the live web |
| Memory | remember a fact about you |

Every one sits behind a switch you control, and it refuses out loud when one is
off.

**See your screen — when you ask.** *"Take a screenshot."* *"What does this
error mean?"* *"I'm stuck on this."* It grabs one frame, at the moment you
asked, and answers about it. No timer, no background capture, nothing stored.

**Know you.** Facts you tell it live in a local file. It also works out your
habits on its own — which apps, when, for how long — and answers about the real
you rather than in generalities.

**Speak first.** It notices what you're doing and occasionally says something
unprompted. If you've been stuck on one thing for a long stretch, or keep
bouncing back to it, it offers to help with that specific thing.

**Reach your other devices.** Watch this PC live, take full mouse-and-keyboard
control (peer-to-peer video and input over WebRTC, with a game mode that sends
relative mouse movement), browse and fetch its files, share a clipboard both
ways. Remote control needs a code emailed to you or a PIN you set.

## Privacy, concretely

- Speech-to-text and the voiceprint run **on-device**. Audio is never uploaded.
- Only the **text** of what you say reaches the assistant, and only once you've
  addressed it.
- Memory and the habits journal are **local files** that never leave the machine.
- Screenshots happen **only on request** and are never retained.
- Remote control shows an unmissable banner the whole time and can be killed
  instantly from the machine being controlled.
- There is **no continuous screen recording and no camera**. Deliberately — see
  [ROADMAP.md](ROADMAP.md) for why that isn't coming either.

## Layout

```
desktop/    Electron + React — the assistant, voice, OS actions, remote control
dashboard/  Next.js — accounts, the device API, and a read-only web view
```

Everything that acts on a machine happens in the desktop app on that machine,
behind its own permissions. The web dashboard is a window, not a control panel.

## Running it

```bash
cd dashboard && npm install && npm run dev   # backend
cd desktop   && npm install && npm run dev   # app
```

`dashboard/.env` needs `DATABASE_URL`, Clerk keys, and `GROQ_API_KEY`. The rest
are optional and degrade rather than break:

| Key | Gives you | Without it |
|---|---|---|
| `ELEVENLABS_API_KEY` | a human voice | the browser's built-in voice |
| `TAVILY_API_KEY` | live web answers | it says so instead of guessing |
| `RESEND_API_KEY` | emailed codes for remote control | falls back to a device PIN |
| `GEMINI_API_KEY` | a second web/vision provider | Groq handles both |

```bash
cd desktop && npm test      # 83 unit tests
cd desktop && npm run dist  # build the installer
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit and where the trust
  boundaries are
- [ROADMAP.md](ROADMAP.md) — what's built, what's next, and what won't be built
