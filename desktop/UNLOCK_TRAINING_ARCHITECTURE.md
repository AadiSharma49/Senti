# Senti Unlock Training Framework

## Overview

This document details the complete architecture for Senti's unlock training system. The framework prepares infrastructure for Voice, Clap, and PIN-based authentication while deferring actual recognition/detection implementation.

---

## 1. Voice Profile Architecture

### Storage Structure

```typescript
interface VoiceProfile {
  trained: boolean                    // true if training completed
  lastTrained: number | null          // timestamp of last training
  phrases: VoicePhrase[]              // all training attempts
  primaryPhrase: VoicePhrase | null   // selected phrase for unlock
  version: 1                          // for future schema migrations
}

interface VoicePhrase {
  phrase: string                      // e.g., "Senti unlock"
  recordedAt: number                  // timestamp
  duration?: number                   // milliseconds
  metadata: {
    confidence?: number               // placeholder for future ML
    quality?: 'poor' | 'fair' | 'good' | 'excellent'
  }
}
```

### Persistence

- **Storage Key**: `senti:voiceProfile`
- **Medium**: `localStorage` (encrypted in production)
- **Fallback**: Default empty profile if corrupted

### Training Flow

1. User selects or enters a custom phrase (e.g., "Senti unlock")
2. System explains training process
3. User records phrase (simulated 3-5 second recording window)
4. Multiple attempts stored (up to 3)
5. User selects best attempt as primary phrase
6. Profile marked as `trained: true`, `lastTrained` set to current timestamp

### Data Captured

- Exact phrase text
- Recording timestamp
- Estimated duration (used for future verification)
- Quality assessment (placeholder for future ML scoring)

### Future Integration Path

When voice recognition is implemented:

```typescript
// Future VoiceDetectionEngine would consume this profile
interface VoiceDetectionEngine {
  // Validates stored profile has required data
  validateProfile(profile: VoiceProfile): boolean
  
  // Detects if current audio matches stored voice phrase
  detect(audioData: AudioBuffer, profile: VoiceProfile): Promise<{
    detected: boolean
    confidence: number
    transcript?: string
  }>
}
```

---

## 2. Clap Profile Architecture

### Storage Structure

```typescript
interface ClapProfile {
  trained: boolean                    // true if training completed
  lastTrained: number | null          // timestamp of last training
  patterns: ClapPattern[]             // all training attempts
  primaryPattern: ClapPattern | null  // selected pattern for unlock
  version: 1                          // for future schema migrations
}

interface ClapPattern {
  clapCount: number                   // e.g., 3 or 4 claps
  timingIntervals: number[]           // milliseconds between claps
  capturedAt: number                  // timestamp
}
```

### Persistence

- **Storage Key**: `senti:clapProfile`
- **Medium**: `localStorage` (encrypted in production)
- **Fallback**: Default empty profile if corrupted

### Training Flow

1. User performs clap sequence (2-5 claps in unique rhythm)
2. System detects individual clap events via button clicks (future: via microphone)
3. Timing intervals recorded between claps
4. Up to 3 attempts stored
5. User selects best attempt as primary pattern
6. Profile marked as `trained: true`, `lastTrained` set to current timestamp

### Data Captured

- Clap count (2-5)
- Timing intervals between claps (milliseconds)
- Capture timestamp
- Pattern signature for future matching

### Future Integration Path

When clap detection is implemented:

```typescript
// Future ClapDetectionEngine would consume this profile
interface ClapDetectionEngine {
  // Validates stored profile has required data
  validateProfile(profile: ClapPattern): boolean
  
  // Detects if current audio matches stored clap pattern
  detect(audioData: AudioBuffer, profile: ClapPattern): Promise<{
    detected: boolean
    confidence: number
    clapSequence?: number[]
  }>
}
```

---

## 3. Storage Design

### Local Storage Keys

```
senti:voiceProfile    → Serialized VoiceProfile
senti:clapProfile     → Serialized ClapProfile
senti:security        → PIN and security settings (existing)
senti:settings:unlockMethods → Enable/disable toggle states (existing)
```

### Data Flow

```
┌─────────────────────┐
│  Training Component │ (VoiceTraining.tsx, ClapTraining.tsx)
│                     │
├─────────────────────┤
│  Training Stores    │ (voiceUnlockStore.ts, clapUnlockStore.ts)
│                     │
├─────────────────────┤
│  localStorage       │ (persistent storage)
│                     │
└─────────────────────┘
```

### Error Handling

- Corrupted JSON in `localStorage` → Default empty profile loaded
- Missing keys → Default profile created
- Storage quota exceeded → Warning logged, old data preserved

---

## 4. Future Detection Integration Path

### Step 1: Audio Capture Layer (Not Implemented)

```typescript
// Future module: services/audioCapture.ts
interface AudioCapture {
  startRecording(): Promise<AudioStream>
  stopRecording(): Promise<AudioBuffer>
  getPermission(): Promise<boolean>
}
```

### Step 2: Detection Engines (Not Implemented)

```typescript
// Future module: services/detectionEngines.ts

interface DetectionResult {
  method: 'voice' | 'clap' | 'pin'
  detected: boolean
  confidence: number
  timestamp: number
}

class VoiceDetectionEngine {
  async detect(
    audioBuffer: AudioBuffer,
    profile: VoiceProfile
  ): Promise<DetectionResult> {
    // 1. Extract audio features
    // 2. Compare against primaryPhrase embeddings
    // 3. Return confidence score
  }
}

class ClapDetectionEngine {
  async detect(
    audioBuffer: AudioBuffer,
    profile: ClapPattern
  ): Promise<DetectionResult> {
    // 1. Detect peak frequencies (clap signature ~4kHz)
    // 2. Count discrete clap events
    // 3. Measure timing intervals
    // 4. Match against primaryPattern
    // 5. Return confidence score
  }
}
```

### Step 3: Unlock Validation Engine (Not Implemented)

```typescript
// Future module: services/unlockValidator.ts

class UnlockValidator {
  async validateWithVoice(profile: VoiceProfile): Promise<boolean> {
    const audioBuffer = await audioCapture.getLatestAudio()
    const result = await voiceEngine.detect(audioBuffer, profile)
    return result.detected && result.confidence > 0.85
  }

  async validateWithClap(profile: ClapPattern): Promise<boolean> {
    const audioBuffer = await audioCapture.getLatestAudio()
    const result = await clapEngine.detect(audioBuffer, profile)
    return result.detected && result.confidence > 0.80
  }

  validateWithPin(enteredPin: string, storedPin: string): boolean {
    // Existing PIN validation logic
    return enteredPin === storedPin
  }

  // Priority-based unlock with fallback chain
  async validateUnlock(
    enabledMethods: {
      voice?: boolean
      clap?: boolean
      pin?: boolean
    }
  ): Promise<'voice' | 'clap' | 'pin' | null> {
    if (enabledMethods.voice && voiceProfile.trained) {
      if (await this.validateWithVoice(voiceProfile)) return 'voice'
    }
    if (enabledMethods.clap && clapProfile.trained) {
      if (await this.validateWithClap(clapProfile)) return 'clap'
    }
    if (enabledMethods.pin) {
      // PIN validation happens in UnlockPanel
      return 'pin'
    }
    return null
  }
}
```

---

## 5. Future Unlock Validation Flow

### LockScreen Integration (Future Enhancement)

When detection engines are implemented, the flow becomes:

```
┌─────────────────────────────────┐
│  User performs unlock action    │
│  (speak phrase, clap, or PIN)   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  AudioCapture records 5 seconds │
└──────────────┬──────────────────┘
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ VoiceEngine  │  │ ClapEngine   │
│   detect()   │  │   detect()   │
└──────────────┘  └──────────────┘
      │                 │
      └────────┬────────┘
               │
               ▼
┌─────────────────────────────────┐
│  UnlockValidator confirms match │
│  confidence > threshold?        │
└──────────────┬──────────────────┘
               │
         ┌─────┴─────┐
         │           │
         ▼           ▼
      UNLOCK    RETRY/FALLBACK
```

### Lockout and Security

- Failed attempts tracked per method
- Shared lockout timer prevents brute force
- PIN remains as final fallback if other methods disabled

---

## 6. Current Implementation Status

### ✅ Completed

- [x] Type definitions for all profiles
- [x] Zustand stores for persistence
- [x] Training UI components (Voice + Clap)
- [x] Training modal with method selection
- [x] Settings panel integration
- [x] Profile management (status, retrain, reset)
- [x] localStorage persistence
- [x] Error handling and fallbacks

### ⏳ Not Yet Implemented (Future)

- [ ] Actual audio capture (microphone API)
- [ ] Voice recognition engine
- [ ] Clap detection algorithm
- [ ] Audio feature extraction
- [ ] ML/Statistical matching
- [ ] Confidence scoring
- [ ] UnlockValidator integration
- [ ] LockScreen detection flow
- [ ] Enable/disable toggle UI
- [ ] Backend recognition service (if needed)

### 🔒 Security Considerations (Future)

- Encrypt profiles in transit
- Hash sensitive data in localStorage
- Implement retry limits per method
- Add tamper detection
- Secure audio buffer handling
- Clear audio data after processing

---

## 7. File Structure

```
src/
├── types/
│   └── unlockProfiles.ts           # All type definitions
├── state/
│   ├── voiceUnlockStore.ts         # Voice profile Zustand store
│   └── clapUnlockStore.ts          # Clap profile Zustand store
├── components/
│   └── training/
│       ├── VoiceTraining.tsx        # Voice training flow
│       ├── ClapTraining.tsx         # Clap training flow
│       └── UnlockTrainingModal.tsx  # Training method selector
└── services/
    ├── audioManager.ts             # Existing audio system
    └── [Future: detectionEngines.ts, unlockValidator.ts]
```

---

## 8. Configuration and Extensibility

### Adding a New Unlock Method

To add a new unlock method (e.g., Fingerprint):

1. Create profile type in `types/unlockProfiles.ts`
2. Create Zustand store in `state/fingerprintUnlockStore.ts`
3. Create training component `components/training/FingerprintTraining.tsx`
4. Add to `UnlockTrainingModal.tsx` method selection
5. Implement `FingerprintDetectionEngine` in future
6. Add to `UnlockValidator` chain

### Version Migration

The `version: 1` field in each profile enables future schema changes:

```typescript
// Example future migration
function migrateVoiceProfile(old: any): VoiceProfile {
  if (old.version === 1) return old as VoiceProfile
  if (old.version === 2) {
    // Handle v2 → v3 migration
    return transformedProfile
  }
}
```

---

## 9. Testing Recommendations

### Unit Tests

- [ ] Profile serialization/deserialization
- [ ] Store actions (record, confirm, complete)
- [ ] Status computation (trained/not-configured/needs-retrain)

### Integration Tests

- [ ] Training flow completion
- [ ] localStorage persistence
- [ ] Profile recovery on app reload
- [ ] Modal open/close behavior

### Future Tests

- [ ] Detection engine accuracy
- [ ] False positive rates
- [ ] Confidence threshold tuning
- [ ] Lockout mechanism

---

## Summary

This framework provides:

✅ **Clean separation** of training UI, state management, and persistence
✅ **Type-safe** profile structures for future expansion
✅ **Extensible architecture** for new detection methods
✅ **Zero coupling** to actual recognition (can be added anytime)
✅ **Graceful degradation** - training works even without audio APIs
✅ **Security foundation** ready for future encryption/hashing

The system is production-ready for training profiles and awaits detection engine implementation.
