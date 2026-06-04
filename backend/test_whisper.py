#!/usr/bin/env python3
"""
Test Faster-Whisper installation and model loading.
"""

import sys
import os
from pathlib import Path

print("[TEST] Starting Faster-Whisper verification...\n")

# Step 1: Check imports
print("=" * 60)
print("STEP 1: Checking imports...")
print("=" * 60)
try:
    from faster_whisper import WhisperModel
    print("✓ faster_whisper imported successfully")
except ImportError as e:
    print(f"✗ Failed to import faster_whisper: {e}")
    sys.exit(1)

try:
    import numpy as np
    print("✓ numpy imported successfully")
except ImportError as e:
    print(f"✗ Failed to import numpy: {e}")
    sys.exit(1)

# Step 2: Show model cache path
print("\n" + "=" * 60)
print("STEP 2: Model cache path...")
print("=" * 60)
model_cache_path = Path(os.path.expanduser("~")) / ".cache" / "faster-whisper"
print(f"Model cache directory: {model_cache_path}")
print(f"Path exists: {model_cache_path.exists()}")

# Step 3: Load a model
print("\n" + "=" * 60)
print("STEP 3: Loading faster-whisper model (base.en)...")
print("=" * 60)
print("This may take a moment on first run (downloads ~140MB)...\n")

try:
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    print("✓ Model loaded successfully (base.en)")
except Exception as e:
    print(f"✗ Failed to load model: {e}")
    sys.exit(1)

# Step 4: Test transcription with a simple tone
print("\n" + "=" * 60)
print("STEP 4: Testing transcription with synthetic audio...")
print("=" * 60)

try:
    # Generate a simple sine wave at 440Hz (note A) for testing
    sample_rate = 16000
    duration = 1  # 1 second
    t = np.linspace(0, duration, int(sample_rate * duration))
    # Generate a simple tone
    audio = np.sin(2 * np.pi * 440 * t).astype(np.float32)
    
    print(f"Generated test audio: {len(audio)} samples at {sample_rate}Hz")
    
    # Transcribe
    print("Running transcription...")
    segments, info = model.transcribe(audio, language="en")
    
    print(f"✓ Transcription completed")
    print(f"  Language detected: {info.language}")
    print(f"  Language probability: {info.language_probability:.2f}")
    print(f"  Segments: {len(list(segments))}")
    
except Exception as e:
    print(f"✗ Transcription failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Step 5: Test with a file if available
print("\n" + "=" * 60)
print("STEP 5: Checking for sample audio files...")
print("=" * 60)

sample_paths = [
    "E:\\Senti\\test_audio.wav",
    "E:\\Senti\\backend\\test_audio.wav",
    "E:\\Senti\\desktop\\public\\assets\\sounds\\",
]

test_file = None
for path in sample_paths:
    if os.path.isfile(path):
        test_file = path
        break
    elif os.path.isdir(path):
        wav_files = list(Path(path).glob("*.wav"))
        if wav_files:
            test_file = str(wav_files[0])
            break

if test_file:
    print(f"Found test audio: {test_file}")
    try:
        print("Transcribing file...")
        segments, info = model.transcribe(test_file, language="en")
        transcript = " ".join([segment.text for segment in segments])
        print(f"✓ File transcription succeeded")
        print(f"  Transcript: {transcript}")
        print(f"  Language: {info.language}")
    except Exception as e:
        print(f"✗ File transcription failed: {e}")
else:
    print("No test audio files found (this is OK for now)")

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)
print("✓ Faster-Whisper is installed and functional")
print(f"✓ Model cache: {model_cache_path}")
print("✓ Ready for backend implementation")
print("\nNext steps:")
print("1. Create e:/Senti/backend/server/main.py with Faster-Whisper service")
print("2. Set up IPC bridge between Electron renderer and Python backend")
print("3. Implement audio chunk streaming from renderer to backend")
