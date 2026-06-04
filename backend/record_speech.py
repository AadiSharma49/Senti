#!/usr/bin/env python3
"""
Record a short audio sample from microphone for transcription testing.
Records 3 seconds of audio - the user should speak during recording.
"""

import sys
import numpy as np
from pathlib import Path

print("[RECORD] Attempting to record microphone audio...\n")

try:
    import sounddevice as sd
except ImportError:
    print("sounddevice not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "sounddevice", "-q"])
    import sounddevice as sd

try:
    import soundfile as sf
except ImportError:
    print("soundfile not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "soundfile", "-q"])
    import soundfile as sf

print("=" * 60)
print("MICROPHONE RECORDING TEST")
print("=" * 60)

# Parameters
sample_rate = 16000
duration = 3
print(f"\nRecording setup:")
print(f"  Sample rate: {sample_rate} Hz")
print(f"  Duration: {duration} seconds")
print(f"  Channels: 1 (mono)")

try:
    # Check available devices
    devices = sd.query_devices()
    print(f"\nAvailable audio devices: {len(devices)}")
    default_input = sd.default.device[0]
    print(f"Default input device: {devices[default_input]['name']}")
    
    print("\n" + "=" * 60)
    print("RECORDING (speak now or it will record silence)...")
    print("=" * 60)
    
    # Record audio
    audio = sd.rec(int(sample_rate * duration), samplerate=sample_rate, channels=1, dtype='float32')
    sd.wait()
    
    print("✓ Recording complete\n")
    
    # Save to file
    output_path = Path("E:/Senti/backend/recorded_speech.wav")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), audio, sample_rate)
    
    print(f"✓ Saved to: {output_path}")
    print(f"  File size: {output_path.stat().st_size / 1024:.1f} KB")
    print(f"  Audio level (RMS): {np.sqrt(np.mean(audio**2)):.4f}")
    
    if np.sqrt(np.mean(audio**2)) < 0.01:
        print("\n⚠ WARNING: Audio level is very low - try speaking louder or closer to the microphone")
    
except Exception as e:
    print(f"\n✗ Recording failed: {e}")
    print("\nNote: Audio recording may not work in this environment.")
    print("You can also provide a speech audio file manually at:")
    print("  E:/Senti/backend/recorded_speech.wav")
    sys.exit(1)

print("\nNext: Run test_transcribe_speech.py to transcribe this recording")
