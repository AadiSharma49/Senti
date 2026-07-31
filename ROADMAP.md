# Senti — where it is and where it's going

Written to be honest rather than promotional. Things that work are listed as
working; things that are rough are listed as rough.

---

## Built and working

**Voice.** Conversation with memory, not commands. Wakes on its name, a
greeting, a bare order ("open Chrome"), or `Ctrl+Shift+Space`. Speech
recognised on-device by Whisper. Ten languages. The activity detector adapts to
your microphone's level and your room's noise floor — a fixed threshold meant
quiet mics only registered their loudest syllable, and whole sentences arrived
as single words.

**Fourteen things it can do.** Apps (including any installed game, and
switching to one already open rather than launching a second), folders, finding
and opening files, temp cleanup, recycle bin, volume, lock, sleep, restart,
shutdown, screenshots, screen understanding, live web answers, and memory.
Each is gated by a permission you control, and the gate is unit-tested.

**Seeing the screen, on request.** "Help me with this" grabs one frame and
answers about it. Runs on the same Groq key as everything else.

**Knowing you.** A local memory file, plus an aggregated habits journal it
reflects on every few hours to work out what's durably true about you. Both
stay on the machine.

**Speaking first.** Notices what you're doing and occasionally comments. Detects
the *shape* of being stuck — one window held a long time, or repeated returns
to it — and offers help with that specific thing.

**Your other devices.** Live screen viewing, full mouse-and-keyboard remote
control over WebRTC (peer-to-peer, 1080p, system audio, game mode with relative
mouse), file browsing, clipboard sync, remote power. Gated by an emailed code
or a PIN.

**83 unit tests** on the code where a break would be invisible: the wake parser
(Senti simply doesn't answer), the permission table (an action would run with
its switch off), path containment for remote files (the UI looks identical
while serving the whole drive), the voice threshold, and memory ranking.

---

## Rough edges, honestly

**Latency is the big one.** ~8s to look at a screen, ~11s for a web answer, a
few seconds for anything else. A person answers in under a second. This is the
single largest gap between "impressive" and "natural", and it's next.

**It can't be interrupted.** Talk over a person and they stop. Senti finishes
its sentence. That one behaviour is most of what separates talking to software
from talking to someone.

**The voice is a stock one.** Every project on the free tier sounds identical.

**Memory ranking is lexical, not semantic.** It matches "drive" to "drive" but
not to "disk". Real embeddings mean bundling another model.

**Everything routes through the cloud.** Two machines on the same Wi-Fi still
talk via the internet.

---

## Next, in order

1. **Latency.** Speak the answer while the audio is still generating, rather
   than after. Biggest felt improvement for the least work.
2. **Interruption.** Stop talking the moment you start.
3. **Its own voice.** Voice *design* rather than cloning — describe how it
   should sound and generate a voice that has never existed. Not a copy of a
   real person, not a stock voice everyone else has.
4. **LAN mode.** Local discovery and signalling so two machines on one network
   don't need the internet.
5. **Semantic memory.** On-device embeddings so recall matches meaning.
6. **A phone PWA**, so the dashboard installs like an app.

---

## Deliberately not building

**Continuous screen capture.** Always-on capture plus autostart plus remote
control is the exact behavioural signature of a RAT, and storing screens means
storing passwords and bank pages. Senti reads the foreground window's *title*
to know you're in a game or watching a video, and takes a screenshot only when
you ask. That gets most of the value and none of the exposure.

**Camera access.** Same reasoning, less justification.

**A raw "run any command" tool.** The model would then be one hallucination
away from deleting your Windows folder, and a webpage it read could talk it
into doing so. The action list is broad and grows on request; it will not
become arbitrary.

**Our own streaming protocol.** WebRTC already does UDP, hardware encoding and
congestion control that Google spent a decade on. Rebuilding it means months of
systems programming to land somewhere worse.

**Waking a powered-off PC.** Nothing is running to receive the request. That
needs Wake-on-LAN configured in BIOS and router — hardware, not software.

---

## Known limits worth stating plainly

- **Fast games over the internet won't feel right.** Even perfect WebRTC is
  40-100ms; games want under 30. On the same Wi-Fi it's genuinely playable.
- **Remote control needs the PC awake** and Senti running. A sleeping machine
  queues commands and runs them when it wakes.
- **Bare imperatives are English-only.** Addressing Senti by name works in any
  language; "open Chrome" with no name matches English verbs literally.
- **Google's free Gemini tier is unreliable.** Some accounts get a zero
  allocation, visible only as a 429. Tavily is the primary web provider for
  that reason.
