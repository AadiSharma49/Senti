# Sound Effect Audit Report

**Date:** June 19, 2026  
**Scope:** Every sound effect trigger in the entire codebase

---

## Audio File Inventory

| File | Mapped Sound IDs |
|------|-----------------|
| `/assets/sounds/crash.mp3` | `crash` |
| `/assets/sounds/denied.mp3` | `denied`, `panel-close` |
| `/assets/sounds/unlock.mp3` | `unlock`, `panel-open`, `save`, `startup` |

Only 3 audio files exist on disk. All 7 sound IDs are mapped from these 3 files.

---

## Sound Trigger Inventory — Every Call Site

### 1. `desktop/src/services/audioManager.ts`

| Line(s) | Code | Sound File | Type |
|---------|------|-----------|------|
| 8 | `'crash': '/assets/sounds/crash.mp3'` | `crash.mp3` | Definition — NOT TRIGGERED ANYWHERE |
| 9 | `'denied': '/assets/sounds/denied.mp3'` | `denied.mp3` | Definition |
| 10 | `'unlock': '/assets/sounds/unlock.mp3'` | `unlock.mp3` | Definition |
| 11 | `'panel-open': '/assets/sounds/unlock.mp3'` | `unlock.mp3` | Definition (same file, different ID) |
| 12 | `'panel-close': '/assets/sounds/denied.mp3'` | `denied.mp3` | **BUG: Closing settings plays the same sound as PIN error** |
| 13 | `'save': '/assets/sounds/unlock.mp3'` | `unlock.mp3` | Definition |
| 14 | `'startup': '/assets/sounds/unlock.mp3'` | `unlock.mp3` | Definition |

### 2. `desktop/src/components/lockscreen/LockScreen.tsx`

| Line(s) | Trigger Type | Code | Sound | Expected | Actual |
|---------|-------------|------|-------|----------|--------|
| 18-23 | `useEffect` on mount | `audioManager.play('startup')` | `unlock.mp3` | Startup sound once per session | ✅ Correct |
| 18 | `useEffect` dependency: `[lock]` | runs effect | — | — | ✅ `lock` is zustand stable reference, fires once |

### 3. `desktop/src/components/common/SettingsPanel.tsx`

| Line(s) | Trigger Type | Code | Sound | Expected | Actual |
|---------|-------------|------|-------|----------|--------|
| 22-23 | `useEffect` when `open=true` | `audioManager.play('panel-open')` | `unlock.mp3` | Sound when settings opens | ✅ Correct |
| **24-25** | **`useEffect` cleanup** | `audioManager.play('panel-close')` | **`denied.mp3`** | **Silence or click** | **🟥 BUG: Closing settings plays the PIN-denied error sound** |
| 50 | `changePin()` success branch | `audioManager.play('save')` | `unlock.mp3` | Sound confirming PIN change | ✅ Correct |
| **74-76** | **"Save & Close" button onClick** | `audioManager.play('save')` then `close()` triggers cleanup | `unlock.mp3` then immediately `denied.mp3` | **Silence or single sound** | **🟥 BUG: Plays unlock success then immediately error/denied** |

### 4. `desktop/src/components/lockscreen/UnlockPanel.tsx`

| Line(s) | Trigger Type | Code | Sound | Expected | Actual |
|---------|-------------|------|-------|----------|--------|
| **42-44** | `handleSubmit()` when `result === 'failed'` | **No sound call** | **None** | **`denied.mp3`** | **🟥 BUG: Wrong PIN plays NO sound** |
| **42-44** | `handleSubmit()` when `result === 'success'` | **No sound call** | **None** | **`unlock.mp3`** | **🟥 BUG: Correct PIN plays NO sound** |
| 42 | `unlock(pin)` calls `lockStore.ts` | State change only | — | — | lockStore has no audio logic (✅ correct separation) |

### 5. `desktop/src/state/lockStore.ts`

| Line(s) | Trigger Type | Code | Sound | Expected | Actual |
|---------|-------------|------|-------|----------|--------|
| 37-64 | `unlock()` action | No audio calls | — | — | ✅ Correct — store should not play sounds |
| 67 | `lock()` action | No audio calls | — | — | ✅ Correct |

### 6. `desktop/src/components/common/SettingsButton.tsx`

| Line(s) | Trigger Type | Code | Sound | Expected | Actual |
|---------|-------------|------|-------|----------|--------|
| 10-12 | `onClick` → `open()` | No sound call | — | — | ✅ Correct (sound is in SettingsPanel's useEffect) |

### 7. `desktop/src/components/onboarding/SetupWizard.tsx`

| Line(s) | Trigger Type | Code | Sound | Expected | Actual |
|---------|-------------|------|-------|----------|--------|
| All | All handlers | No sound calls | — | — | **✅ No sounds in SetupWizard** |

---

## Bug Analysis

### Bug 1: Wrong PIN sound plays when closing Settings panel

**Root Cause:**
- `desktop/src/components/common/SettingsPanel.tsx`, lines 24-25
```typescript
return () => {
  audioManager.play('panel-close')  // line 25
}
```
- `panel-close` is mapped to `denied.mp3` in `audioManager.ts` line 12
- The `Close` button (line 82: `onClick={close}`) triggers the `open` state to flip to `false`
- React runs the cleanup function → plays `denied.mp3` (same sound file as PIN error)

**Exact call chain:**
1. User clicks `Close` button (line 82)
2. `close()` → sets `open=false` in `uiStore`
3. React re-renders, `open` changed, `useEffect([open])` cleanup fires
4. `audioManager.play('panel-close')` → plays `/assets/sounds/denied.mp3`
5. This is the identical sound that should only play on PIN failure

**Sound file collision:** `denied.mp3` is used for TWO unrelated purposes:
- PIN entry failure (intended)
- Settings panel closing (unintended bug)

### Bug 2: Wrong PIN sound does NOT play on PIN failure

**Root Cause:**
- `desktop/src/components/lockscreen/UnlockPanel.tsx`, lines 42-44
```typescript
const result = await unlock(pin)
if (result === 'failed') { setPinInput(''); setShake(true); setTimeout(() => setShake(false), 500) }
else if (result === 'success') { setPinInput('') }
```
- Neither branch calls `audioManager.play()`
- The failure case only does visual shake/clear — **no audio feedback**
- The success case only clears input — **no audio feedback**

### Bug 3: "Save & Close" plays two conflicting sounds

**Root Cause:**
- `desktop/src/components/common/SettingsPanel.tsx`, lines 74-76
```typescript
onClick={() => {
  audioManager.play('save')   // unlock.mp3
  close()                     // triggers cleanup → denied.mp3
}}
```
- User hears `unlock.mp3` then immediately `denied.mp3` (conflicting tones)

---

## Orchestration Diagram

```
SettingsButton (gear icon)
  └─ onClick → open() [uiStore]
       └─ SettingsPanel open=true
            └─ useEffect [open] runs
                 ├─ play('panel-open') = unlock.mp3    ← OK
                 └─ registers cleanup
                      └─ runs when open=false (Close/Save button)
                           └─ play('panel-close') = denied.mp3  ← BUG 1

UnlockPanel handleSubmit()
  └─ unlock(pin)
       ├─ success → state='unlocking' → 'unlocked'
       │   └─ No audio call                               ← BUG 2b
       └─ failed → state='failed_attempt'
           └─ No audio call                               ← BUG 2a

"Save & Close" button
  ├─ play('save') = unlock.mp3
  └─ close() → cleanup → play('panel-close') = denied.mp3  ← BUG 3
```

---

## Proposed Minimal Fix

> **Do not change UI. Do not refactor unrelated code.**

### Fix 1: Add sound to PIN failure (`UnlockPanel.tsx`)
- **File:** `desktop/src/components/lockscreen/UnlockPanel.tsx`
- **Line 43 (failure branch):** Add `audioManager.play('denied')`
- **Line 44 (success branch):** Add `audioManager.play('unlock')`

### Fix 2: Remove sound from Settings panel close (`SettingsPanel.tsx`)
- **File:** `desktop/src/components/common/SettingsPanel.tsx`
- **Line 25:** Remove `audioManager.play('panel-close')` from the useEffect cleanup
- The `Close` button only needs to close — no sound needed

### Fix 3: Remove sound from "Save & Close" (`SettingsPanel.tsx`)
- **File:** `desktop/src/components/common/SettingsPanel.tsx`
- **Line 75:** Remove `audioManager.play('save')` from the Save & Close handler
- The `changePin()` function (line 50) already plays `play('save')` on successful PIN change
- If no changes were made, no sound should play

### Optional cleanup: Remove unused sound IDs
- `'panel-open'`: Can keep — adds polish to opening panel
- `'panel-close'`: Stop using — mapped to error sound, causes confusion
- `'crash'`: Currently unused in codebase — harmless, can keep for future
- `'save'`: Only needed in `changePin()` — already in correct location

---

## Summary Table Before Fix

| Sound ID | File | Trigger | Expected Behavior | Actual Behavior |
|----------|------|---------|-------------------|-----------------|
| `startup` | LockScreen.tsx:20 | Lock screen mount | Play unlock.mp3 once | ✅ Correct |
| `panel-open` | SettingsPanel.tsx:23 | Panel opens | Play unlock.mp3 | ✅ Correct |
| `panel-close` | SettingsPanel.tsx:25 | Panel closes (cleanup) | **No sound** | 🟥 Plays denied.mp3 (error sound) |
| `save` | SettingsPanel.tsx:50 | PIN changed successfully | Play unlock.mp3 | ✅ Correct |
| `save` + `panel-close` | SettingsPanel.tsx:75 | "Save & Close" click | **Single sound or none** | 🟥 Plays unlock.mp3 then denied.mp3 |
| `denied` | — | PIN entry fails | **Play denied.mp3** | 🟥 **Never called** |
| `unlock` | — | PIN entry succeeds | **Play unlock.mp3** | 🟥 **Never called** |
| `crash` | — | — | — | Not used (harmless) |