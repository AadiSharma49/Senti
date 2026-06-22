# Senti — Foundation Reset Audit Report

**Date:** June 19, 2026  
**Scope:** Full codebase review for foundation reset  
**Goal:** Identify what to keep, what to remove, and dependencies to clean up

---

## 1. Complete Architecture Overview

Senti is an Electron + React + TypeScript application with a Zustand state management layer. It functions as a Windows lock screen that overlays the user's desktop fullscreen.

### Architecture Layers

| Layer | Technology | Description |
|-------|-----------|-------------|
| Window Management | Electron (main.ts, preload.ts) | Creates fullscreen lock window, manages focus/security |
| Renderer | React 18 + Vite | UI rendering with framer-motion animations |
| State | Zustand (4 stores) | Lock state, settings, theme, UI (missing) |
| Services | TypeScript modules | Audio management, unlock validation, microphone capture (some missing) |
| Backend IPC (TO BE REMOVED) | Electron IPC + Python subprocess | Spawns Python backends for voice/speaker verification |
| Backend (TO BE REMOVED) | Python (not found on disk) | voice_biometrics.py, main.py — referenced but don't exist |
| Training (TO BE REMOVED) | React components (missing from disk) | ClapDetectionDeveloper, VoiceVerificationTest, UnlockTrainingModal |

### Application Flow

1. Electron starts → spawns Python backend (currently active!) → creates fullscreen window
2. App.tsx checks if setup is completed — if not, shows SetupWizard
3. If setup complete, shows LockScreen with: Background → ParticleField → Visualizer → UnlockPanel → GreetingPlayer → SettingsButton
4. GreetingPlayer plays startup sound → transitions to 'locked' state
5. LockScreen shows unlock panel with Voice, Clap, and PIN methods
6. On successful PIN unlock → 'unlocking' → 'unlocked' → window closes after 900ms

---

## 2. Folder Structure Overview

```
e:\Senti/
├── .gitignore
├── package-lock.json
├── VERIFICATION_REPORT.md
├── config/
│   └── wallpapers/                    # (empty)
├── docs/                              # (empty)
├── desktop/
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── loading.html                   # (loading splash, keep)
│   ├── dist-electron/                 # Compiled Electron files (can be rebuilt)
│   │   ├── main.js
│   │   └── preload.cjs
│   ├── electron/
│   │   ├── main.ts                    # 🟥 NEEDS MAJOR CLEANUP
│   │   └── preload.ts                 # 🟥 NEEDS MAJOR CLEANUP
│   ├── public/
│   │   └── assets/
│   │       └── sounds/
│   │           ├── crash.mp3          # ✅ KEEP
│   │           ├── denied.mp3         # ✅ KEEP
│   │           └── unlock.mp3         # ✅ KEEP
│   └── src/
│       ├── main.tsx                   # ✅ KEEP (entry point)
│       ├── App.tsx                    # 🟡 NEEDS MODIFICATION
│       ├── index.css                  # ✅ KEEP
│       ├── vite-env.d.ts              # 🟥 NEEDS CLEANUP
│       ├── api/                       # (empty directory, DELETE)
│       ├── config/
│       │   └── greetings.json         # 🟥 DELETE (personalized to "Aadi Sir")
│       ├── hooks/
│       │   └── useWallpaper.ts        # ✅ KEEP
│       ├── state/
│       │   ├── lockStore.ts           # ✅ KEEP (needs voice/clap cleanup)
│       │   ├── settingsStore.ts       # 🟡 NEEDS CLEANUP (voice/clap config)
│       │   ├── themeStore.ts          # ✅ KEEP
│       │   └── uiStore.ts             # 🟥 MISSING ON DISK - referenced in imports
│       ├── types/                     # (empty directory)
│       ├── services/
│       │   ├── unlockValidation.ts    # 🟥 DELETE (clap-specific validation)
│       │   ├── audioManager.ts        # 🟥 MISSING ON DISK - referenced in imports
│       │   ├── microphoneCapture.ts   # 🟥 MISSING ON DISK - referenced in imports
│       │   ├── audioAnalyzer.ts       # 🟥 MISSING ON DISK - referenced in imports
│       │   ├── clapDetectionEngine.ts # 🟥 MISSING ON DISK - referenced in imports
│       │   └── clapPatternValidator.ts# 🟥 MISSING ON DISK - referenced in imports
│       ├── theme/
│       │   ├── themeEngine.ts         # ✅ KEEP
│       │   └── ThemeProvider.tsx       # ✅ KEEP
│       ├── components/
│       │   ├── common/
│       │   │   ├── Background.tsx     # ✅ KEEP
│       │   │   ├── Clock.tsx          # ✅ KEEP
│       │   │   ├── GreetingPlayer.tsx # 🟡 KEEP BUT MODIFY (remove TTS/greeting references)
│       │   │   ├── ParticleField.tsx  # ✅ KEEP
│       │   │   ├── SettingsButton.tsx # ✅ KEEP
│       │   │   ├── SettingsPanel.tsx  # 🟥 NEEDS CLEANUP (voice/clap sections)
│       │   │   └── index.ts           # ✅ KEEP
│       │   ├── lockscreen/
│       │   │   ├── LockScreen.tsx     # ✅ KEEP (remove GreetingPlayer)
│       │   │   ├── UnlockPanel.tsx    # 🟥 NEEDS MAJOR CLEANUP
│       │   │   └── WallpaperPicker.tsx# ✅ KEEP
│       │   ├── onboarding/
│       │   │   └── SetupWizard.tsx    # 🟡 NEEDS MODIFICATION (remove identity/greeting fields)
│       │   ├── training/              # (empty directory - files referenced but missing)
│       │   │   ├── ClapDetectionDeveloper.tsx  # 🟥 Does not exist on disk
│       │   │   ├── VoiceVerificationTest.tsx   # 🟥 Does not exist on disk
│       │   │   └── UnlockTrainingModal.tsx     # 🟥 Does not exist on disk
│       │   └── visualizer/
│       │       └── Visualizer.tsx     # ✅ KEEP
│       └── (other supporting files)
└── .venv/                            # Python venv with ML dependencies (full cleanup needed)
```

---

## 3. Voice-Related Files

### Source files that reference voice:

| File | Description | Action |
|------|-------------|--------|
| `desktop/electron/main.ts` | Spawns voice backend process, handles voice IPC (`voice:start`, `voice:stop`, `voice:transcribe`), speaker verification IPC (`speaker:enroll`, `speaker:verify`, `speaker:finalize`, `speaker:status`, `speaker:reset`, `speaker:threshold`) | **DELETE ALL voice/speaker IPC handlers** |
| `desktop/electron/preload.ts` | Exposes `voiceApi` (start/stop/transcribe), `speakerApi` (enroll/finalize/verify/status/reset/setThreshold), `onBackendStatus`, `healthCheck`, `getBackendStatus` | **DELETE ALL voice/speaker API exposure** |
| `desktop/src/vite-env.d.ts` | TypeScript declarations for SentiAPI including `voiceStart`, `voiceStop`, `voiceTranscribe`, `sendToBackend`, `healthCheck`, `playGreeting`, `onBackendStatus`, `onBackendAlert` | **CLEAN UP** — remove voice/backend types |
| `desktop/src/state/settingsStore.ts` | Stores `unlockMethods.voice` config (enabled, configured, threshold, selectedDeviceId, sensitivity) | **REMOVE voice settings** |
| `desktop/src/state/voiceUnlockStore.ts` | Referenced in UnlockPanel.tsx, SettingsPanel.tsx — **MISSING ON DISK** | **DELETE references** |
| `desktop/src/components/lockscreen/UnlockPanel.tsx` | Full voice unlock UI: microphone capture, voice verification, backend status display, similarity meter | **DELETE ENTIRE voice section** |
| `desktop/src/components/common/SettingsPanel.tsx` | Voice unlock settings: training button, sensitivity slider, remove profile | **DELETE ENTIRE voice section** |
| `desktop/src/components/training/VoiceVerificationTest.tsx` | Referenced in App.tsx — **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/components/training/UnlockTrainingModal.tsx` | Referenced in SettingsPanel.tsx — **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/microphoneCapture.ts` | **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/audioAnalyzer.ts` | **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/clapDetectionEngine.ts` | **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/audioManager.ts` | **MISSING ON DISK** — imported by GreetingPlayer.tsx, SettingsPanel.tsx | Investigate — this might be needed for sound effects |
| `.venv/Lib/site-packages/` | Contains `_sounddevice`, `_soundfile`, `webrtcvad`, `resemblyzer` (?) — Python dependencies for voice processing | **DELETE entire venv** |

---

## 4. Clap-Related Files

| File | Description | Action |
|------|-------------|--------|
| `desktop/src/state/settingsStore.ts` | Stores `unlockMethods.clap` config (enabled, configured) | **REMOVE clap settings** |
| `desktop/src/state/clapUnlockStore.ts` | Referenced in UnlockPanel.tsx, SettingsPanel.tsx — **MISSING ON DISK** | **DELETE references** |
| `desktop/src/components/lockscreen/UnlockPanel.tsx` | Full clap unlock UI: microphone listener, clap detection engine, profile comparison | **DELETE ENTIRE clap section** |
| `desktop/src/components/common/SettingsPanel.tsx` | Clap unlock settings: enable checkbox, training button, remove pattern | **DELETE ENTIRE clap section** |
| `desktop/src/components/training/ClapDetectionDeveloper.tsx` | Referenced in App.tsx — **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/components/training/UnlockTrainingModal.tsx` | Referenced in SettingsPanel.tsx — **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/unlockValidation.ts` | `validateUnlock()` function for clap patterns, imports `clapPatternValidator` | **DELETE** |
| `desktop/src/services/clapDetectionEngine.ts` | **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/clapPatternValidator.ts` | Referenced in unlockValidation.ts — **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/microphoneCapture.ts` | **MISSING ON DISK** | **DELETE reference** |
| `desktop/src/services/audioAnalyzer.ts` | **MISSING ON DISK** | **DELETE reference** |

---

## 5. Backend-Related Files

### Python Backend Infrastructure:

| File | Description | Action |
|------|-------------|--------|
| `e:/Senti/.venv/` | Full Python virtual environment with ML packages (sounddevice, soundfile, webrtcvad, etc.) | **DELETE** |
| `backend/` directory | No `backend/` directory exists on disk. All references to `backend/server/main.py` and `backend/server/voice_biometrics.py` point to non-existent paths | N/A (doesn't exist) |

### Backend IPC in Electron:

| Section in `desktop/electron/main.ts` | Lines | Purpose | Action |
|--------|-------|---------|--------|
| Backend process spawning | 503-582 | `spawnBackend()` — Spawns Python voice backend | **DELETE** |
| Speaker backend spawning | 295-394 | `spawnSpeakerBackend()` — Spawns separate speaker verification Python process | **DELETE** |
| sendBackendCommand | 257-274 | Sends JSON commands to backend stdin | **DELETE** |
| sendSpeakerCommand | 396-406 | Sends commands to speaker backend | **DELETE** |
| invokeSpeakerCommand | 408-467 | Promise-based async command with event bus response | **DELETE** |
| handleBackendLine | 469-501 | Parses backend stdout JSON events | **DELETE** |
| Backend startup | 611-612 | `spawnBackend()` call in app.whenReady | **DELETE** |
| Backend shutdown | 630-636 | `sendBackendCommand('voice:stop')` in before-quit | **DELETE** |
| IPC: voice:start, voice:stop, voice:transcribe | 668-689 | Voice transcription IPC handlers | **DELETE** |
| IPC: speaker:enroll, speaker:finalize, speaker:verify | 695-714 | Speaker enrollment/verification IPC | **DELETE** |
| IPC: speaker:status, speaker:reset, speaker:threshold | 716-739 | Speaker management IPC | **DELETE** |
| IPC: senti:backend-health | 650-655 | Backend health check | **DELETE** |
| IPC: backend:getStatus | 658-661 | Cached backend status | **DELETE** |
| IPC: senti:play-greeting | 663-666 | TTS greeting (already returns null) | **DELETE** |
| speakerResponseBus | 11-12 | Event bus for speaker backend | **DELETE** |
| latestBackendStatus | 28-32 | Cached backend status object | **DELETE** |
| Backend stdout buffer | 25 | `stdoutBuffer` variable | **DELETE** |
| Backend process variable | 22 | `backendProcess` | **DELETE** |
| Backend status flags | 23-24 | `backendReady`, `modelLoaded` | **DELETE** |
| Speaker backend variables | 281-282 | `speakerBackendProcess`, `speakerBackendReady` | **DELETE** |
| Runtime check in createWindow | 168-179 | Logs `window.senti.speaker` etc. | **DELETE** |

### Backend in Preload:

| Section | Lines | Purpose | Action |
|---------|-------|---------|--------|
| voiceApi | 11-15 | Voice start/stop/transcribe IPC | **DELETE** |
| speakerApi | 17-28 | Speaker enroll/finalize/verify/status/reset/setThreshold IPC | **DELETE** |
| contextBridge exposure | 30-49 | Exposes voice, speaker, healthCheck, getBackendStatus, onBackendStatus | **DELETE (voice/speaker/backend parts)** |

---

## 6. Safe-to-Delete Files

### Files to DELETE entirely:

| File | Reason |
|------|--------|
| `desktop/src/config/greetings.json` | Contains personalized greetings for "Aadi Sir" — needs to be generic or removed |
| `desktop/src/services/unlockValidation.ts` | Clap-specific validation logic |
| `desktop/src/services/microphoneCapture.ts` | Voice/clap microphone capture — **MISSING, but delete reference** |
| `desktop/src/services/audioAnalyzer.ts` | Voice/clap audio analysis — **MISSING, but delete reference** |
| `desktop/src/services/clapDetectionEngine.ts` | Clap detection — **MISSING, but delete reference** |
| `desktop/src/services/clapPatternValidator.ts` | Clap pattern validation — **MISSING, but delete reference** |
| `desktop/src/components/training/ClapDetectionDeveloper.tsx` | Debug component for clap — **MISSING, but delete reference** |
| `desktop/src/components/training/VoiceVerificationTest.tsx` | Debug component for voice — **MISSING, but delete reference** |
| `desktop/src/components/training/UnlockTrainingModal.tsx` | Training modal for voice/clap — **MISSING, but delete reference** |
| `desktop/src/state/uiStore.ts` | **MISSING ON DISK** — need to create minimal version or remove references |
| `desktop/src/state/clapUnlockStore.ts` | **MISSING ON DISK** |
| `desktop/src/state/voiceUnlockStore.ts` | **MISSING ON DISK** |
| `desktop/src/types/unlockProfiles.ts` | **MISSING ON DISK** — referred to in imports |
| `desktop/src/types/` directory | Empty directory |
| `desktop/src/api/` directory | Empty directory |
| `desktop/src/components/training/` directory | Empty directory |
| `docs/` directory | Empty |
| `config/wallpapers/` directory | Empty |
| `.venv/` directory | Entire Python virtual environment (~5000+ files) |
| `backend/` directory | Does not exist — no action needed |

---

## 7. Files That Must Stay

### Core Application Files:

| File | Description |
|------|-------------|
| `desktop/package.json` | Project configuration, dependencies |
| `desktop/tsconfig.json` | TypeScript configuration |
| `desktop/vite.config.ts` | Vite build config |
| `desktop/tailwind.config.js` | Tailwind CSS config |
| `desktop/postcss.config.js` | PostCSS config |
| `desktop/index.html` | HTML entry point |
| `desktop/src/main.tsx` | React entry point |
| `desktop/src/index.css` | Global styles, theme variables, utility classes |

### UI Components (KEEP):

| File | Description |
|------|-------------|
| `desktop/src/components/common/Background.tsx` | Animated background with gradients |
| `desktop/src/components/common/Clock.tsx` | Time/date display |
| `desktop/src/components/common/ParticleField.tsx` | Ambient particle effect |
| `desktop/src/components/common/SettingsButton.tsx` | Settings gear button |
| `desktop/src/components/common/SettingsPanel.tsx` | **NEEDS CLEANUP** - remove voice/clap sections |
| `desktop/src/components/common/index.ts` | Re-export barrel file |
| `desktop/src/components/lockscreen/LockScreen.tsx` | Main lock screen |
| `desktop/src/components/lockscreen/UnlockPanel.tsx` | **NEEDS MAJOR CLEANUP** - remove voice/clap sections |
| `desktop/src/components/lockscreen/WallpaperPicker.tsx` | Wallpaper selection |
| `desktop/src/components/visualizer/Visualizer.tsx` | Animated orb visualizer |

### State Stores (KEEP, with cleanup):

| File | Description |
|------|-------------|
| `desktop/src/state/lockStore.ts` | Lock state machine — **remove unlockWithVoice/unlockWithClap if they exist** |
| `desktop/src/state/settingsStore.ts` | Settings — **remove voice/clap unlock methods and identity fields** |
| `desktop/src/state/themeStore.ts` | Theme dark/light toggle |

### Theme (KEEP):

| File | Description |
|------|-------------|
| `desktop/src/theme/themeEngine.ts` | CSS variable application |
| `desktop/src/theme/ThemeProvider.tsx` | Theme context provider |

### Hooks (KEEP):

| File | Description |
|------|-------------|
| `desktop/src/hooks/useWallpaper.ts` | Wallpaper storage/management |

### Sound Effects (KEEP):

| File | Description |
|------|-------------|
| `desktop/public/assets/sounds/crash.mp3` | Error sound |
| `desktop/public/assets/sounds/denied.mp3` | Denied sound |
| `desktop/public/assets/sounds/unlock.mp3` | Unlock success sound |

---

## 8. Dependency Cleanup Recommendations

### Package Dependencies (`desktop/package.json`):

| Dependency | Status | Notes |
|------------|--------|-------|
| `react` ^18.3.1 | ✅ KEEP | Core UI framework |
| `react-dom` ^18.3.1 | ✅ KEEP | React DOM |
| `zustand` ^4.5.0 | ✅ KEEP | State management |
| `framer-motion` ^11.0.0 | ✅ KEEP | Animations |

### Dev Dependencies:

| Dependency | Status | Notes |
|------------|--------|-------|
| `@types/react` | ✅ KEEP | TypeScript types |
| `@types/react-dom` | ✅ KEEP | TypeScript types |
| `@vitejs/plugin-react` | ✅ KEEP | Vite plugin |
| `autoprefixer` | ✅ KEEP | PostCSS |
| `concurrently` | ✅ KEEP | Dev server |
| `electron` ^30.0.0 | ✅ KEEP | Window management |
| `electron-builder` | ✅ KEEP | Build tooling |
| `postcss` | ✅ KEEP | CSS processing |
| `tailwindcss` | ✅ KEEP | CSS framework |
| `typescript` ^5.4.0 | ✅ KEEP | Language support |
| `vite` ^5.4.0 | ✅ KEEP | Build tool |
| `vite-plugin-electron` | ✅ KEEP | Electron integration |
| `vite-plugin-electron-renderer` | ✅ KEEP | Electron renderer |
| `wait-on` | ✅ KEEP | Dev server wait |

### Python Virtual Environment (`.venv/`):

All Python dependencies can be removed. Currently contains:
- `sounddevice`, `soundfile` — Audio capture
- `webrtcvad` — Voice activity detection
- `resemblyzer` — Speaker verification (likely)
- `aifc` — Audio file handling
- `_cffi_backend` — C foreign function interface
- `portaudio` — Audio I/O library

**Action: DELETE entire `.venv/` directory**

---

## 9. Technical Debt List

### Critical Issues:

1. **Backend is being spawned on startup** — `desktop/electron/main.ts` line 612 calls `spawnBackend()` which tries to launch a Python process. The backend scripts don't exist on disk, so this will fail silently every time the app starts.

2. **Missing files referenced in imports** — Multiple files imported in production code don't exist on disk:
   - `desktop/src/state/uiStore.ts` (imported by SettingsButton.tsx, SettingsPanel.tsx)
   - `desktop/src/services/audioManager.ts` (imported by GreetingPlayer.tsx, SettingsPanel.tsx)
   - `desktop/src/services/microphoneCapture.ts` (imported by UnlockPanel.tsx)
   - `desktop/src/services/audioAnalyzer.ts` (imported by UnlockPanel.tsx)
   - `desktop/src/services/clapDetectionEngine.ts` (imported by UnlockPanel.tsx)
   - `desktop/src/state/clapUnlockStore.ts` (imported by UnlockPanel.tsx, SettingsPanel.tsx)
   - `desktop/src/state/voiceUnlockStore.ts` (imported by UnlockPanel.tsx, SettingsPanel.tsx)
   - `desktop/src/types/unlockProfiles.ts` (imported by unlockValidation.ts, UnlockPanel.tsx)
   - `desktop/src/components/training/ClapDetectionDeveloper.tsx` (imported by App.tsx)
   - `desktop/src/components/training/VoiceVerificationTest.tsx` (imported by App.tsx)
   - `desktop/src/components/training/UnlockTrainingModal.tsx` (imported by SettingsPanel.tsx)

3. **Identity personalization** — `desktop/src/config/greetings.json` is hardcoded with "Aadi Sir" greetings. The SetupWizard and SettingsPanel collect username, greetingName, and title fields that personalize the experience. This must be removed for a generic lock screen.

4. **Electron main.ts is extremely bloated** — 739 lines with massive backend spawning infrastructure (Python process management, IPC handlers for voice/speaker, event buses). This needs to be stripped down to ~150-200 lines.

5. **TypeScript compilation will fail** — The missing files above will cause build errors. The project likely cannot compile in its current state because `unlockWithVoice` is used in UnlockPanel.tsx line 27 but doesn't exist in lockStore.ts.

### Medium Issues:

6. **Empty directories** — `desktop/src/api/`, `desktop/src/types/`, `desktop/src/components/training/`, `docs/`, `config/wallpapers/` are all empty. These should be removed or documented.

7. **Checkbox comment typo** — `desktop/src/components/common/SettingsPanel.tsx` line 93: `handleRemoveVoiceProfile` uses `await` on `resetVoiceProfile()` — suggests async but implementation may not be.

8. **`.venv/` is bloated** — 50,000+ files in the Python virtual environment. This should be removed entirely as there's no backend Python code on disk.

9. **Debug keyboard shortcut** — `App.tsx` lines 22-31 register `Ctrl+Shift+V` to toggle VoiceVerificationTest. This is debug code that should be removed.

### Minor Issues:

10. **Comment says disabled** — `desktop/electron/main.ts` line 611 says "Backend spawning disabled until architecture is implemented" but the very next line (612) calls `spawnBackend()`. The comment is misleading.

11. **Runtime diagnostics** — `desktop/electron/main.ts` lines 168-179 execute JavaScript in the renderer to log window.senti properties. This is debug code.

12. **Stale TODO** — `desktop/electron/main.ts` line 584: `// TODO: TTS integration` is a stale mention of future feature.

---

## Summary of Required Changes

### Directories to Delete:
- `.venv/` (entire virtual environment)
- `desktop/src/api/` (empty)
- `desktop/src/types/` (empty)
- `desktop/src/components/training/` (empty)
- `docs/` (empty)
- `config/wallpapers/` (empty)

### Files to Create (minimal replacements for missing):
- `desktop/src/state/uiStore.ts` — Minimal store for settings panel open/close state
- `desktop/src/services/audioManager.ts` — Sound effect management (preload/play/stop for the 3 .mp3 files)

### Files to Massively Clean:
- `desktop/electron/main.ts` — Remove all backend/speaker/voice code
- `desktop/electron/preload.ts` — Remove all voice/speaker/backend API
- `desktop/src/vite-env.d.ts` — Clean up SentiAPI interface
- `desktop/src/App.tsx` — Remove voice test debug toggle, remove ClapDetectionDeveloper/VoiceVerificationTest imports
- `desktop/src/components/lockscreen/UnlockPanel.tsx` — Remove voice and clap unlock sections
- `desktop/src/components/common/SettingsPanel.tsx` — Remove voice/clap training sections
- `desktop/src/state/settingsStore.ts` — Remove voice/clap unlock methods, remove identity fields
- `desktop/src/state/lockStore.ts` — Remove unlockWithVoice/unlockWithClap references if they exist

### Files to Modify (light cleanup):
- `desktop/src/components/onboarding/SetupWizard.tsx` — Remove identity/greeting name/title fields, simplify to PIN-only
- `desktop/src/components/common/GreetingPlayer.tsx` — Simplify to just play startup sound, remove TTS references
- `desktop/src/config/greetings.json` — Remove or replace with generic system messages

### Files to Keep As-Is:
- All UI components (Background, Clock, ParticleField, Visualizer)
- State stores (themeStore)
- Theme system
- Wallpaper support
- Sound effects (3 .mp3 files)
- Infrastructure configs (package.json, vite.config, tailwind, tsconfig, postcss)