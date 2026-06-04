#!/usr/bin/env python3
"""
Generate a test audio file by speaking a phrase and recording it.
Or use pydub to create a simple spoken word test.
"""

import sys
from pathlib import Path

print("[AUDIO GEN] Creating test audio file...\n")

try:
    import numpy as np
    from scipy.io import wavfile
except ImportError as e:
    print(f"Missing package: {e}")
    print("Available: scipy, pydub")
    sys.exit(1)

# Since we can't speak programmatically without TTS, we'll create
# a simple recognizable pattern for testing: silence with some tones

sample_rate = 16000
duration_seconds = 2

# Create a test signal with multiple frequencies to see if Whisper detects it
# We'll create something that might produce output
audio_signal = []

# Add some silence
silence_duration = int(sample_rate * 0.5)
audio_signal.extend([0] * silence_duration)

# Add a simple tone burst (not speech, but tests the pipeline)
freq = 440
t = np.linspace(0, 0.5, int(sample_rate * 0.5))
tone = np.sin(2 * np.pi * freq * t) * 0.3
audio_signal.extend(tone)

# Add silence
audio_signal.extend([0] * silence_duration)

# Add another frequency to make it more interesting
freq2 = 880
t = np.linspace(0, 0.5, int(sample_rate * 0.5))
tone2 = np.sin(2 * np.pi * freq2 * t) * 0.3
audio_signal.extend(tone2)

audio = np.array(audio_signal, dtype=np.float32)

# Normalize to prevent clipping
max_val = np.max(np.abs(audio))
if max_val > 0:
    audio = audio / max_val * 0.95

# Convert to int16 for WAV file
audio_int16 = (audio * 32767).astype(np.int16)

output_path = Path("E:/Senti/backend/test_audio.wav")
output_path.parent.mkdir(parents=True, exist_ok=True)

wavfile.write(str(output_path), sample_rate, audio_int16)
print(f"✓ Test audio file created: {output_path}")
print(f"  Sample rate: {sample_rate} Hz")
print(f"  Duration: {len(audio) / sample_rate:.2f} seconds")
print(f"  File size: {output_path.stat().st_size / 1024:.1f} KB")
