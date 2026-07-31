# Senti

A voice assistant that lives on your Windows PC and actually operates it.

You talk to it like a person — "open Chrome", "clean up my temp files", "what's
the latest in tech" — and it does the thing and answers out loud. Speech is
transcribed **on your machine**; your audio never leaves it.

From another of your own devices you can watch this PC's screen, take real
mouse-and-keyboard control of it, browse its files, and share a clipboard.

---

## What it does

**Talk to it.** Say its name, say hello, give it an order, or press
`Ctrl+Shift+Space`. Then just keep talking — it's a conversation with memory,
not a command line. Say "stop" when you're done.

**It runs your machine.** Opens any installed app or game, closes apps, opens
folders, finds and opens files, clears temp files and the recycle bin, controls
volume, locks/sleeps/restarts/shuts down, searches the web, reads out live tech
news. Every action sits behind a switch you control, and it refuses out loud
when one is off.

**It learns you.** Facts you tell it are kept in a local file, and it works out
your habits on its own from how you actually use the PC — then answers about the
real you rather than in generalities.

**It speaks first.** Now and then it notices what you're doing and says
something unprompted. It reads the foreground window's *title* only; it does not
watch your screen.

**Your other devices.** Watch this PC live, take full control of it (video and
input travel peer-to-peer over WebRTC, with a game mode that sends relative
mouse movement), browse and fetch its files, and share a clipboard both ways.

## Privacy, concretely

- Speech-to-text and the voiceprint run **on-device**. Audio is never uploaded.
- Only the **text** of what you say goes to the assistant, and only once you've
  addressed it.
- Memory and the habits journal are **local files** that never leave the machine.
- Remote control requires a code emailed to you (or a PIN you set), shows an
  unmissable banner the whole time, and can be killed instantly from the machine
  being controlled.
- There is **no screen recording and no camera**. Deliberately.

## Layout

```
desktop/    Electron + React — the assistant, voice, OS actions, remote control
dashboard/  Next.js — accounts, the device API, and a read-only web view
```

Everything that acts on a machine happens in the desktop app, behind that
device's own permissions. The web dashboard is a window, not a control panel.

## Running it

```bash
# backend
cd dashboard && npm install && npm run dev

# app
cd desktop && npm install && npm run dev
```

`dashboard/.env` needs at minimum `DATABASE_URL`, Clerk keys, and `GROQ_API_KEY`.
`ELEVENLABS_API_KEY` gives it a human voice, `RESEND_API_KEY` enables emailed
codes for remote control, `GEMINI_API_KEY` adds live web search — all optional,
and the features degrade rather than break without them.

```bash
cd desktop && npm test      # unit tests
cd desktop && npm run dist  # build the installer
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together and where
the trust boundaries are.
