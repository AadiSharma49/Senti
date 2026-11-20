# Two-peer remote-control loopback

Windows, installed Edge, Git, and Node 24 (tested with 24.11.1). No npm packages, EdgeDriver, Electron instance, credentials, backend, or running app needed. Run from the repository root, **one run at a time**:

```powershell
# Strict smoke test of the working tree; reports JSON to stdout, nonzero on failure.
node desktop/tests/loopback/run.mjs

# Compare the same preset and interval against a frozen Git revision without checking it out.
node desktop/tests/loopback/run.mjs --rev a3d1809 --observe-legacy --preset sharp --seconds 8 > before.json
node desktop/tests/loopback/run.mjs --preset sharp --seconds 8 > after.json
```

`--preset` accepts `smooth` (default), `balanced`, or `sharp`. `--seconds` is the measurement window (2–60, default 6); discovery, warm-up and recovery tests take additional time. Use `--edge "C:\path\to\msedge.exe"` if not in the usual location. `--observe-legacy` **only** makes ordered/reliable channel configuration, readiness callbacks, and automatic recovery observational rather than required. Missing video, dropped/reordered keys, fallback HTTP during the key test, and failed cleanup still fail. Inspect individual `checks`, not just the exit code, when comparing old revisions.

## What it exercises

- The real renderer modules (`remoteControl.connectPeer`, `webrtc.startHostPeer`, the real `sendEvent`, quality presets and API wrapper) run in separate host/viewer JS realms. Node transforms the selected TypeScript with its built-in transformer. No Vite config, `.env` or deployed service is loaded. `--rev` reads **all** imported renderer modules via `git show`; the test driver always comes from the working tree. The JSON includes the commit and a fingerprint of the served renderer modules.
- Each realm gets an in-memory `window.senti.api` bound to its test identity. A mock session start + PIN verification enables an oldest-first, consume-on-read, opposite-peer signalling mailbox. Offers, answers and ICE are not manufactured. This tests the client against a fixture, **not** backend authentication/rate limiting.
- A moving canvas drawn on animation frames is the only media source. `captureStream(preset.fps)` caps its video track; no camera, mic, screen picker, audio, injector, or OS input API is used. The receiver attaches the stream to a playing video. ICE servers are cleared, both peers run in one Edge instance, and only the loopback HTTP server is started (uses `PORT` if set, otherwise an ephemeral port, with a random route). The temporary profile is unique to the run and the runner closes its process tree and removes it on completion or handled interruption.
- The FPS denominator is the interval between inbound RTP stats timestamps; the numerators are deltas of `framesReceived` and `framesDecoded`. Dimensions come from the received video at the end, not requested track constraints. Codec and selected ICE candidate pair come from the same receiver report. Frame gaps are percentiles of **observed presentation times** from `requestVideoFrameCallback`, not network latency or encoder frame spacing. Slow main-thread scheduling can skip callbacks. Sender quality-limitation stats and canvas draw cadence give additional context.
- Each key test sends synthetic keydowns and matching keyups over multiple flushes. The host callback records key type and key name rather than injecting anything. The harness checks order, count, and absence of HTTP deliveries. A passive listener on the actual channel independently records its ordering and retransmission limits. Observing in-order delivery on a loss-free connection is **not** evidence that an unordered channel guarantees it.
- The fault is `close()` on the **host's native peer connection**, not a fake state event. The app must report loss and recovery and negotiate new peers under the same session ID (new offer **and** answer, new receiver stats/decoded frames, visible frames and 8 ordered key events). No test code calls `connectPeer` again in that session. Finally both peers hang up and a fresh verified session must connect and deliver input on the same module instances.

## Observations on this Windows host

Stock headless Edge 157.0.4341.60, frozen baseline `a3d1809` versus edited renderer modules. Each row is one short sample, not an average; all used **H.264, host/UDP ↔ host/UDP**, with no observed RTP packet loss. Width and height below are **received**, not source dimensions.

| Source / requested preset | Window | Received size | Received / decoded FPS | Presentation gap p95 / max | Automatic recovery after close |
|---|---:|---:|---:|---:|---:|
| Frozen / 720p60 smooth | 6 s | 1280×720 | 59.3 / 59.5 | 28.1 / 43.8 ms | Not within 12 s |
| Edited / 720p60 smooth | 6 s | 1280×720 | 59.5 / 59.5 | 33.1 / 52.6 ms | 3.47 s |
| Edited / 1080p30 balanced | 8 s | 1920×1080 | 29.5 / 29.5 | 57.2 / 93.9 ms | 5.84 s |
| Frozen / 1080p60 sharp | 8 s | 1920×1080 | 39.8 / 38.9 | 54.2 / 174.2 ms | Not within 12 s |
| Edited / 1080p60 sharp | 8 s | 1920×1080 | 35.8 / 32.8 | 67.8 / 166.5 ms | 4.41 s |
| Edited / 1080p60 sharp (repeat, viewer stats API) | 8 s | 1920×1080 | 41.6 / 41.6 | 47.9 / 108.1 ms | 6.46 s |

All runs delivered the initial 64/64 key events in order to the host sink (zero HTTP events during each key test) and opened a fresh session after hangup. Only the edited runs used an ordered channel with neither a retransmission nor a packet-lifetime cap; the baseline used `ordered: false, maxRetransmits: 0`. Only the edited runs reconnected in the same session, with two offers/two answers total, false→true readiness callbacks, newly presented video and another 8/8 ordered events. A separate edited smooth run delivered 57.9 decoded FPS at **640×360** despite its 720p60 source. A preset is a ceiling, not a guaranteed resolution or frame rate.

## Checking the actual PCs

1. Update both apps and the dashboard. Use two separately linked PCs, enable remote control on the target, and verify the session normally. Nothing in the test tooling bypasses verification in a real session.
2. Start on the same LAN with **balanced**. Scroll a long page or drag a window for 15 seconds; static desktops need not produce new frames. Read the viewer header: negotiated **WebRTC direct**, **WebRTC TURN relay**, or **HTTP JPEG fallback**. TURN still carries normal video. JPEG is capped by the 200 ms upload and 250 ms viewer poll even on a perfect network.
3. Note received dimensions, decoded fps, codec, RTT, and (in the tooltip) dropped frames and freezes. Compare **smooth** on the same motion. If 720p60 looks better than 1080p60 with similar RTT, start with the lower pixel workload. RTT is network round-trip time, not click-to-photon latency.
4. Repeat on the problem network. Persistent JPEG there but not on the LAN points to RTC establishment/ICE; check the TURN settings and relay reachability on both ends rather than increasing the JPEG rate. To end the test, use the host Stop button and confirm input and remote capture cease.

## Interpretation

This is a transport smoke test and short measurement, not a 60 FPS acceptance target. It bypasses the production screen-capture, JPEG fallback, host poller, UI, native keyboard injection, Electron IPC, actual two-device auth, NAT/TURN, WAN loss/jitter, physical displays and end-to-end input latency. The failure test is an explicit transport close, not a silent Internet partition. Decode and encode contend on one machine; compare repeated quiet-machine runs before attributing FPS or gap changes to code. Use two actual devices and the receiver diagnostics to validate real capture and link behavior separately.
