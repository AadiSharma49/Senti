# Senti — how it works, end to end

Two parts, with a deliberate line between them: **everything that acts on a
machine happens on that machine**, behind its own permissions. The server holds
accounts and passes messages.

```
   ┌────────────────────────────────┐        ┌──────────────────────────┐
   │  YOUR PC — desktop app         │        │  DASHBOARD (Vercel)      │
   │  Electron + React              │        │  Next.js + Clerk         │
   │                                │        │  Postgres (Neon)         │
   │  • Whisper STT      (on-device)│◄──────►│                          │
   │  • voiceprint       (on-device)│  text  │  • accounts, devices     │
   │  • 13 OS actions               │  only  │  • the AI brain + voice  │
   │  • screenshots (on request)    │        │  • message passing       │
   │  • memory + habits  (local)    │        │  • web + vision lookup   │
   │  • remote control host/viewer  │        │                          │
   │                                │        │  device token: hashed    │
   │  audio + memory NEVER  ────────┼───X    │  no audio, ever          │
   └────────────────────────────────┘        └──────────────────────────┘
              ▲                                        ▲
              │  WebRTC: video + input                 │  read-only web view
              │  peer-to-peer, never via server        │  (watch a screen)
              ▼                                        │
   ┌────────────────────────────────┐                  │
   │  YOUR LAPTOP / PHONE           │──────────────────┘
   └────────────────────────────────┘
```

## The desktop app

**Hearing you.** The mic feeds a voice-activity detector whose threshold tracks
the room's noise floor — a fixed cutoff meant a quiet microphone only registered
its loudest syllable, so sentences arrived as fragments. Speech segments go to
Whisper, running locally. Audio never leaves.

**Deciding it was addressed.** `wakeParse` decides whether you were talking to
Senti: its name, a greeting, or a bare imperative ("open Chrome") all count;
ordinary conversation doesn't. That gate is the only thing between you and an
assistant that answers the television, and it fails *silently* when wrong — so
it's pure, Electron-free, and unit-tested in both directions.

**Doing things.** Thirteen actions on the machine (plus `ask_web`, which the
server answers), each mapped to a permission in a table
(`actionPermissions.ts`) that's tested, because an action shipped without a
permission would run regardless of the user's switches. `runAction` consults
that same table — it previously checked its own inline conditions, which meant
the tests were green against a table the running code never read. The model
chooses an action by NAME; it never supplies a command. Unknown names are
refused.

**Seeing.** `take_screenshot` saves a frame; `look_at_screen` sends one to a
vision model and answers about it. Both fire only on request — there is no
timer and nothing is retained. That is the entire distinction between this and
surveillance, and it's structural rather than a policy: no code path captures
the screen without an incoming request.

**Knowing you.** Facts live in a local file. An aggregated activity journal —
app, day, rough time-of-day, minutes — lets Senti reflect every few hours and
write down what's durably true about you. Aggregation is the privacy design:
storing every window title with a timestamp would be a log of everything you
opened.

## The dashboard

Accounts, devices, and the AI brain. It is **not** a control panel: the web view
can watch a screen and see device status, and that's it. Everything that acts on
a machine goes through the desktop app on that machine.

Device routes (`/api/device/*`) are called from Electron's main process, so they
carry no `Origin` header — and any request that *does* have one is rejected.
That's stronger than a CORS allowlist: instead of telling one origin "yes", it
tells every browser "no".

## Remote control

A session needs a code emailed to the owner (or a PIN set on the target). Until
it's verified the session grants nothing; input sent before then is rejected.

Once verified, the two machines exchange a WebRTC handshake through the server
and then talk **directly** — screen video and every keystroke flow peer-to-peer
and stop touching our infrastructure. Input rides a data channel, which removes
the poll latency from every click.

Injected input goes through one long-lived PowerShell process using
`mouse_event`/`keybd_event`. Positions are normalised and applied as
DPI-independent absolute coordinates; game mode sends relative deltas instead,
because games read raw movement and never see a cursor position.

Input events are **deleted the moment they're delivered**. This must not become
a keylogger, and not keeping the data is the only way to be sure.

## What crosses the boundary

**Never leaves your PC:** raw audio, your voiceprint in usable form (uploaded
only encrypted, so it can sync between your own devices), your memory file, your
habits journal.

**Leaves by design:** the text of what you say (to reach the brain), device
status, one screenshot when you ask a question about your screen, and — only
while you're sharing — screen frames or a peer-to-peer video stream.

**Not built, on purpose:** CONTINUOUS screen capture and camera access.
Always-on capture plus autostart plus remote control is the exact behavioural
signature of a RAT, and storing screens means storing other people's passwords
and bank pages. Senti reads the foreground window's *title* to know you're in a
game or watching a video, and takes a screenshot only when asked — which gets
most of the value and none of that.

## Safety-critical code, and why it's tested

| Module | Why a break would be invisible |
| --- | --- |
| `wakeParse` | Senti just doesn't answer. No error anywhere. |
| `actionPermissions` | An action would run with its switch off. |
| `pathSafety` | Remote file access would serve the whole drive, looking identical. |
| `voiceActivityDetector` | Sentences arrive as fragments; transcription looks wrong instead. |
| `memoryRecall` | Relevant memories quietly stop being sent. |
| `stuckSignal` | It nags while you're concentrating, or never offers help at all. |

```bash
cd desktop && npm test
```
