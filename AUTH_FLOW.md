# Senti Authentication State Machine

## Overview

Senti uses a centralized authentication state machine to manage the lock screen lifecycle. The state machine is implemented in `lockStore.ts` (Zustand) and typed in `types/auth.ts`. It abstracts away individual auth methods so the UI and future backends only need to query one source of truth.

---

## Auth Methods

| Method | Key | Status | Notes |
|---|---|---|---|
| Voice | `voice` | Planned | Requires microphone capture + backend verification |
| Clap | `clap` | Planned | Requires audio processing + backend verification |
| PIN | `pin` | Active | Local-only fallback, always available |
| Remote | `remote` | Future | Dashboard or paired device unlock |
| Telegram | `telegram` | Future | Recovery / remote unlock via Telegram bot |

Enabled methods are stored in `settingsStore.security.enabledMethods`. The state machine only transitions into `listening_voice` or `listening_clap` if the corresponding method is enabled.

---

## Session States

| State | Description |
|---|---|
| `booting` | App is initializing; short transition before lock screen appears |
| `locked` | Default idle state. awaiting an auth attempt. |
| `listening_voice` | Waiting for voice input (only when `voice` is enabled). |
| `listening_clap` | Waiting for clap input (only when `clap` is enabled). |
| `pin_entry` | Waiting for PIN input. |
| `verifying` | Processing auth result (reserved for backend calls). |
| `failed` | Auth attempt failed; not yet locked out. |
| `lockout` | Too many failed attempts; timed lockout active. |
| `unlocked` | Auth succeeded. System is unlocked. |

---

## State Transitions

```
                    +------------------+
                    |     booting       |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |      locked       | <----------------+
                    +--------+---------+                 |
                             |                          |
         +-------------------+-------------------+      |
         |                   |                   |      |
         v                   v                   v      |
  +--------------+   +--------------+   +--------------+ |
  | listening_   |   | listening_   |   |  pin_entry   | |
  |   voice      |   |   clap       |   +------+-------+ |
  +------+-------+   +------+-------+          |       |
         |                  |                   v       |
         |                  |            +--------------+|
         |                  |            |  verifying   ||
         |                  |            +------+-------+
         |                  |                   |
         |                  |         +---------+---------+
         |                  |         |                   |
         |                  v         v                   |
         |                  +------------------+          |
         |                  |      failed       |          |
         |                  +--------+---------+          |
         |                           |                   |
         |                           +-------------------+
         |                           |
         |                           v
         |                  +------------------+
         |                  |     lockout       |
         |                  +--------+---------+
         |                           |
         |                           v
         |                  +------------------+
         |                  |      locked       |
         |                  +-------------------+
         |
         v
  +------------------+
  |     unlocked      | <---------------------------------------+
  +-------------------+                                          |
                                                                |
  (UI triggers lock after timeout or manual re-lock)            |
                                                                |
  +-------------------------------------------------------------+
```

### Transition Rules

1. **booting → locked**: `startBoot()` completes, app ready.
2. **locked → listening_voice**: `startVoiceAttempt()` (only if `voice` in `enabledMethods`).
3. **locked → listening_clap**: `startClapAttempt()` (only if `clap` in `enabledMethods`).
4. **locked → PIN entry**: `enterPinEntry()`.
5. **listening_voice → unlocked**: `authSuccess()`.
6. **listening_clap → unlocked**: `authSuccess()`.
7. **listening_voice → listening_clap**: `authFail()` (fallback chain).
8. **listening_clap → pin_entry**: `authFail()` (fallback chain).
9. **pin_entry → unlocked**: `authSuccess()`.
10. **pin_entry → failed**: `authFail()`.
11. **failed → unlocked**: `authSuccess()`.
12. **failed → lockout**: `authFail()` when `failedAttempts >= maxAttempts`.
13. **failed → pin_entry**: allowed if fallback to PIN is desired.
14. **lockout → locked**: lockout timer expires.
15. **verifying → unlocked**: backend confirms success.
16. **verifying → failed**: backend confirms failure.
17. **unlocked → locked**: manual re-lock or timeout.

---

## Fallback Order

The default fallback chain is:

1. `voice` (if enabled)
2. `clap` (if enabled)
3. `pin` (always available)

Failure at any step advances to the next fallback. PIN failures increment `failedAttempts`. After `maxAttempts` failures (default 3), the system enters `lockout` for `lockoutDuration` seconds (default 30).

---

## State Machine API

```typescript
interface LockStore {
  state: SessionState
  currentAuthMethod: AuthMethod | null
  failedAttempts: number
  lockoutUntil: number | null

  startBoot: () => void
  lock: () => void
  startVoiceAttempt: () => void
  startClapAttempt: () => void
  enterPinEntry: () => void
  authSuccess: () => void
  authFail: () => void
  resetFailedAttempts: () => void
}
```

---

## Future Expansion

- **Dashboard as source of truth**: Remote configuration will sync `enabledMethods`, `maxAttempts`, and `lockoutDuration` from the web dashboard to the desktop client.
- **Remote unlock**: Add `remote` and `telegram` to the fallback chain with their own listeners.
- **Verifying state**: Wire to real backend calls for voice/clap scoring.
- **Multi-user accounts**: Extend `AuthConfig` with per-user method preferences.
