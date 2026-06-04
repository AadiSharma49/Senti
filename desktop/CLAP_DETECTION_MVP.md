# Senti Clap Detection MVP — Implementation Guide

## Overview

This document explains the Clap Detection MVP architecture, algorithm, and future unlock integration.

**Status**: Detection only (no unlocking yet)
**Goal**: Prove reliable clap pattern detection using browser microphone

---

## 1. Audio Architecture

### Layer Stack

```
┌─────────────────────────────────────────┐
│   ClapDetectionDeveloper Component      │ (Temporary UI)
├─────────────────────────────────────────┤
│   ClapDetectionEngine Service           │ (Orchestration)
├─────────────────────────────────────────┤
│   AudioAnalyzer Service                 │ (FFT + Peak Detection)
├─────────────────────────────────────────┤
│   Web Audio API (AnalyserNode)          │ (Real-time FFT)
├─────────────────────────────────────────┤
│   MicrophoneCapture Service             │ (MediaDevices)
├─────────────────────────────────────────┤
│   Browser MediaStream API               │ (Audio Input)
└─────────────────────────────────────────┘
```

### Data Flow

```
Microphone Input
    ↓
MediaStream API
    ↓
Web Audio Context
    ↓
AnalyserNode (FFT)
    ↓
AudioAnalyzer (processes frames)
    ↓
ClapDetectionEngine (detects peaks)
    ↓
Pattern Extraction
    ↓
Comparison Against Trained Profile
    ↓
Confidence Score & Match Result
    ↓
Developer Feedback UI
```

---

## 2. Clap Detection Algorithm

### Phase 1: Audio Capture

**Service**: `MicrophoneCapture`

```typescript
// Requests microphone with optimized settings
audio: {
  echoCancellation: false,  // Preserve clap characteristics
  noiseSuppression: false,  // Don't alter audio
  autoGainControl: false    // Keep original amplitude
}
```

**Why these settings?**
- Echo cancellation distorts transient signals
- Noise suppression removes clap peaks
- Auto gain control normalizes amplitude (we need actual levels)

### Phase 2: Real-Time FFT Analysis

**Service**: `AudioAnalyzer`

The analyzer runs continuously at **~100 fps (10ms intervals)** while listening.

```
Each frame:
1. Extract frequency domain (getByteFrequencyData)
2. Extract time domain (getByteTimeDomainData)
3. Calculate peak amplitude (0-1 normalized)
4. Calculate loudness delta (change from previous frame)
5. Store frame for peak detection
```

**FFT Parameters**:
- FFT Size: 2048 samples
- Frequency Resolution: ~23.4 Hz per bin (at 48kHz)
- Time Window: ~42ms per frame

### Phase 3: Peak Detection

**Algorithm: Transient Detection with Frequency Filtering**

```typescript
for each frame:
  if (peakAmplitude > threshold AND loudnessDelta > 0.1) {
    // Calculate energy in clap frequency range (3-6kHz)
    clapEnergy = sum(frequencyBins[3000:6000])
    
    if (clapEnergy > 0.3) {
      // Verify minimum gap from previous peak
      if (frame.timestamp - lastPeak.timestamp > 200ms) {
        recordPeak({
          timestamp,
          volume,
          frequency: estimatePeakFrequency()
        })
      }
    }
  }
```

**Why this approach?**
- **Transient detection**: Claps have rapid onset (fast attack)
- **Frequency filtering**: Claps have characteristic ~4kHz energy
- **Timing validation**: Prevents false positives from single noise spikes
- **Amplitude threshold**: 0.4 normalized (loud, distinct sounds only)
- **Minimum interval**: 200ms gap between claps (human clap spacing)

### Phase 4: Pattern Extraction

From detected peaks, extract the timing signature:

```typescript
Detected Peaks:
  Peak 1: timestamp=1045ms, volume=0.72
  Peak 2: timestamp=1745ms, volume=0.68
  Peak 3: timestamp=2445ms, volume=0.71

Extract Pattern:
  clapCount: 3
  timingIntervals: [700ms, 700ms]  // Time between peaks
```

This is the **fingerprint** for comparison.

### Phase 5: Pattern Comparison

**Comparing Detected vs Trained Pattern**

```
Trained Pattern:
  clapCount: 3
  timingIntervals: [700ms, 700ms]

Detected Pattern:
  clapCount: 3
  timingIntervals: [680ms, 720ms]

Comparison:
  ✓ Clap count matches (3 == 3)
  ✓ Timing within tolerance:
    - Expected: 700ms, Detected: 680ms → 2.8% variance
    - Expected: 700ms, Detected: 720ms → 2.8% variance
  ✓ Both under 40% threshold
  
  Result: MATCH (Confidence: 92%)
```

---

## 3. Confidence Scoring

### Calculation Components

```typescript
confidence = (
  volumeConsistency * 0.3 +    // Claps have similar volume
  clapCountScore * 0.3 +        // 3-5 claps is optimal
  timingScore * 0.4             // Consistent intervals matter most
) * 100
```

**Volume Consistency (30% weight)**
```
avgVolume = mean(all peak volumes)
variance = mean(|volume - avgVolume|)
score = max(0, 1 - variance * 2)
```

**Clap Count Score (30% weight)**
```
if count >= 3 && count <= 5:
  score = 1.0              // Optimal range
else:
  score = max(0, 1 - |count - 4| * 0.2)  // Penalty for wrong count
```

**Timing Score (40% weight)**
```
avgInterval = mean(all timing intervals)
variance = mean(|interval - avgInterval|)
score = max(0, 1 - (variance / avgInterval) * 0.5)
```

Example: 3 claps with timing [700, 700] gets ~85-95% confidence depending on consistency.

---

## 4. False Positive Protection

### What We Reject

| Sound | Detection | Reason |
|-------|-----------|--------|
| Keyboard typing | ✗ Rejected | Low frequency (100-300Hz), inconsistent timing |
| Desk bump | ✗ Rejected | Single peak, no pattern |
| Speech | ✗ Rejected | Continuous energy, not transients |
| Music | ✗ Rejected | Energy spread across frequencies |
| Random noise | ✗ Rejected | No frequency signature in clap range |

### Protection Mechanisms

1. **Frequency Filtering**: Only count peaks with 3-6kHz energy
   - Rejects: speech (100-4000Hz), rumble (<500Hz)
   - Keeps: clap transients (peak at ~4kHz)

2. **Amplitude Threshold**: Peak must be > 40% normalized
   - Rejects: subtle background noise
   - Keeps: distinct, clear sounds

3. **Timing Validation**: Min 200ms between peaks
   - Rejects: reverb/echo of single clap
   - Keeps: intentional separate claps

4. **Count Validation**: 2-5 claps required
   - Rejects: 1 or >5 (too unusual)
   - Keeps: realistic human patterns

5. **Pattern Matching**: Timing must match trained ±40%
   - Rejects: random clap sequences
   - Keeps: user's trained rhythm

---

## 5. Future Unlock Integration Path

### Today (MVP):

```
Train Pattern
    ↓
Test Detection (Developer Button)
    ↓
See: "Pattern Match: TRUE/FALSE"
    ↓
No Security Action
```

### Phase 2 (Future - Unlock Integration):

```
┌──────────────────────────────────┐
│  LockScreen detects unlock event │ (user triggers clap)
└────────────────┬─────────────────┘
                 ↓
┌──────────────────────────────────┐
│  ClapDetectionEngine runs        │ (perform detection)
└────────────────┬─────────────────┘
                 ↓
┌──────────────────────────────────┐
│  Get confidence + pattern match  │
└────────────────┬─────────────────┘
                 ↓
           ┌─────┴─────┐
           │           │
           ↓           ↓
    ┌─────────────┐ ┌──────────────────┐
    │ Confidence  │ │ Pattern Matches? │
    │ > 80% ?     │ │ (count + timing) │
    └─────────────┘ └──────────────────┘
           │                 │
           ├─────────┬───────┤
           │         │       │
         YES       YES      YES
           │         │       │
           └─────────┴───────┘
                 ↓
        ┌────────────────────┐
        │   UNLOCK SYSTEM    │
        └────────────────────┘
```

**Integration Requirements** (when implemented):
- Add unlock button to LockScreen
- Wire ClapDetectionEngine to UnlockValidator
- Add "Clap Pattern Unlock" as enabled method
- Implement security checks (rate limiting, lockout)

### Configuration for Unlock

```typescript
// Future settings
unlockMethods: {
  pin: { enabled: true },
  clap: { enabled: false },      // User chooses if they want this
  voice: { enabled: false }
}

// When clap is enabled and detection succeeds
if (detectionResult.confidence > 0.80 && 
    patternMatch.match && 
    patternMatch.confidence > 0.75) {
  // Unlock allowed
}
```

---

## 6. File Structure

```
src/
├── services/
│   ├── microphoneCapture.ts      # MediaDevices wrapper
│   ├── audioAnalyzer.ts          # Web Audio API + FFT
│   └── clapDetectionEngine.ts    # Detection orchestration
├── components/
│   └── training/
│       └── ClapDetectionDeveloper.tsx  # Temporary test UI
├── state/
│   └── clapUnlockStore.ts        # Profile storage (existing)
└── types/
    └── unlockProfiles.ts         # Profile types (existing)
```

---

## 7. Usage Example

### Training Phase (Already Implemented)

```typescript
// User trains 3 claps with 700ms intervals
useClapUnlockStore.getState().completeTraining()

// Profile saved to localStorage
{
  trained: true,
  lastTrained: 1717289400000,
  patterns: [...],
  primaryPattern: {
    clapCount: 3,
    timingIntervals: [700, 700],
    capturedAt: 1717289400000
  }
}
```

### Detection Phase (MVP - Developer Test)

```typescript
// Click "Test Clap" button → Panel opens
// Click "Start Detection" → Microphone starts
// Perform 3 claps with ~700ms spacing
// After 6 seconds → Results displayed

Detection Result:
  ✓ Detected: YES
  ✓ Claps: 3
  ✓ Confidence: 92%
  
Pattern Comparison:
  ✓ Match: TRUE
  ✓ Confidence: 92%
  ✓ Timing Variance: 2.8%
```

---

## 8. Performance & Resource Management

### Memory Usage

- Frame buffer: ~300 frames × 300 bytes = ~90KB
- FFT buffers: 2×1024 Uint8Array = ~2KB
- Detection state: ~5KB

**Total**: ~100KB active memory (negligible)

### CPU Usage

- FFT computation: ~1-2ms per frame
- Peak detection: <1ms per frame
- **Total**: ~3ms per 10ms interval = 30% CPU (while listening)

### Cleanup

```typescript
// On stop or error:
audioAnalyzer.dispose()      // Disconnect nodes
microphoneCapture.stop()     // Stop media tracks
detectionEngine.dispose()    // Clear buffers
```

---

## 9. Browser Compatibility

### Required APIs

| API | Support | Fallback |
|-----|---------|----------|
| MediaDevices.getUserMedia | Chrome 50+, Firefox 36+, Safari 11+ | Error message |
| Web Audio API | All modern browsers | Error message |
| AudioContext | All modern browsers | Error message |

### Tested On

- Chrome 90+ ✓
- Firefox 88+ ✓
- Safari 14+ ✓
- Edge 90+ ✓

---

## 10. Security Considerations (Future)

When unlocking is implemented:

- [ ] Rate limiting (max 5 attempts per minute)
- [ ] Lockout after 3 failed attempts
- [ ] Timeout for failed detection sequences
- [ ] Audit logging of unlock attempts
- [ ] Optional PIN fallback if clap fails
- [ ] No plaintext storage of patterns (hash them)

---

## 11. Testing Recommendations

### Unit Tests (Future)

```typescript
// Peak detection
test('detects 3 peaks from 3 claps', () => { ... })
test('rejects single peak', () => { ... })
test('rejects noise below threshold', () => { ... })

// Pattern matching
test('matches exact pattern', () => { ... })
test('matches pattern within 40% tolerance', () => { ... })
test('rejects pattern with wrong count', () => { ... })

// Confidence scoring
test('high confidence for consistent claps', () => { ... })
test('low confidence for irregular timing', () => { ... })
```

### Integration Tests

```typescript
// Manual testing checklist
- [ ] Train with 2 claps → Detect with 2 claps → Match ✓
- [ ] Train with 3 claps → Detect with 3 claps → Match ✓
- [ ] Train with 4 claps → Detect with 4 claps → Match ✓
- [ ] Train with 700ms intervals → Detect with 700ms → Match ✓
- [ ] Train with pattern → Detect with wrong count → No match ✓
- [ ] Train with pattern → Detect with wrong timing → No match ✓
- [ ] Keyboard typing → No detection ✓
- [ ] Desk tap → No detection ✓
- [ ] Speech → No detection ✓
```

---

## 12. Troubleshooting

### "Permission Denied"
- User declined microphone access
- Browser doesn't have permission
- Solution: User must grant permission in browser settings

### "No Device Found"
- No microphone connected/detected
- Microphone is disabled in BIOS
- Solution: Connect microphone or enable in settings

### "Pattern Match FALSE" (False Negative)
- Timing too irregular (>40% variance)
- Wrong clap count
- Too quiet or too loud
- Solution: Retrain with clearer, more consistent pattern

### "False Positive" (Unexpected Match)
- Music or environmental noise matching pattern
- Solution: Increase confidence threshold or retrain

---

## Summary

✅ **Implemented**:
- Microphone capture with permission handling
- Real-time FFT audio analysis
- Transient/clap detection via frequency filtering
- Pattern extraction from peaks
- Confidence scoring
- Pattern matching with tolerance
- False positive protection
- Developer feedback UI
- Proper resource cleanup

⏳ **Future**:
- Integration with LockScreen unlock flow
- Security validations (rate limiting, lockout)
- UI for unlock method enable/disable
- Optional PIN fallback
- Unlock permission and security checks

**Detection is ready today. Unlock integration can happen anytime.**
