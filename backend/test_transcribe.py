#!/usr/bin/env python3
"""
Full test: Load model and transcribe the generated test audio file.
"""

import sys
import os
from pathlib import Path
from faster_whisper import WhisperModel

print("[TRANSCRIPTION TEST] Starting full transcription test...\n")

# Load model
print("=" * 60)
print("Loading faster-whisper model...")
print("=" * 60)
try:
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    print("✓ Model loaded\n")
except Exception as e:
    print(f"✗ Failed to load model: {e}")
    sys.exit(1)

# Transcribe the test file
test_file = Path("E:/Senti/backend/test_audio.wav")
if not test_file.exists():
    print(f"✗ Test file not found: {test_file}")
    sys.exit(1)

print("=" * 60)
print(f"Transcribing: {test_file}")
print("=" * 60)
print(f"File size: {test_file.stat().st_size / 1024:.1f} KB\n")

try:
    print("Running transcription (this may take a moment)...\n")
    segments, info = model.transcribe(str(test_file), language="en")
    
    # Collect segments
    segment_list = list(segments)
    
    print("=" * 60)
    print("TRANSCRIPTION RESULTS")
    print("=" * 60)
    print(f"Language: {info.language}")
    print(f"Language probability: {info.language_probability:.4f}")
    print(f"Duration: {info.duration:.2f} seconds")
    print(f"Total segments: {len(segment_list)}\n")
    
    if segment_list:
        print("Segments:")
        for i, segment in enumerate(segment_list, 1):
            print(f"  [{i}] {segment.start:.2f}s - {segment.end:.2f}s")
            print(f"      Text: {segment.text}")
            print(f"      Confidence: {segment.confidence:.4f}\n")
        
        full_transcript = " ".join([seg.text for seg in segment_list])
        print(f"Full transcript: {full_transcript}")
    else:
        print("(No speech detected in audio - this is expected for tone-only test)")
    
    print("\n" + "=" * 60)
    print("✓ TRANSCRIPTION TEST PASSED")
    print("=" * 60)
    
except Exception as e:
    print(f"\n✗ TRANSCRIPTION FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Show model cache path
print(f"\nModel cache directory: {Path.home() / '.cache' / 'faster-whisper'}")
print("\nBackend setup verification complete!")
print("Ready to implement Electron IPC bridge.")
