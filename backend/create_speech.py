#!/usr/bin/env python3
"""
Create a test audio file with a spoken phrase using text-to-speech.
"""

import sys
from pathlib import Path
import numpy as np

print("[TTS] Creating speech audio file...\n")

# Try to use pyttsx3 or gTTS
try:
    import pyttsx3
    use_tts = "pyttsx3"
except ImportError:
    use_tts = None

if use_tts is None:
    try:
        from gtts import gTTS
        use_tts = "gtts"
    except ImportError:
        use_tts = None

if use_tts is None:
    print("No TTS available (pyttsx3 and gTTS not installed)")
    print("Creating synthetic speech-like audio instead...\n")
    
    # Create a synthetic audio file that mimics speech patterns
    sample_rate = 16000
    duration = 2.0
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Simulate speech formants (frequencies in speech)
    # F1: 700Hz, F2: 1200Hz, F3: 2600Hz (for vowel 'a')
    formants = [700, 1200, 2600]
    
    audio = np.zeros_like(t)
    for freq in formants:
        audio += 0.3 * np.sin(2 * np.pi * freq * t)
    
    # Add some amplitude modulation to make it more speech-like
    envelope = np.abs(np.sin(2 * np.pi * 2 * t)) ** 0.5  # 2 Hz modulation
    audio = audio * envelope
    
    # Add some noise floor
    audio += 0.05 * np.random.randn(len(audio))
    
    # Normalize
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio = audio / max_val * 0.8
    
    # Convert to int16
    audio_int16 = (audio * 32767).astype(np.int16)
    
    # Save
    from scipy.io import wavfile
    output_path = Path("E:/Senti/backend/synthetic_speech.wav")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(output_path), sample_rate, audio_int16)
    
    print(f"✓ Created synthetic speech audio: {output_path}")
    print(f"  Formants: 700Hz, 1200Hz, 2600Hz (vowel 'a')")
    print(f"  Duration: {duration} seconds")

elif use_tts == "pyttsx3":
    print("Using pyttsx3 for speech generation...\n")
    engine = pyttsx3.init()
    engine.setProperty('rate', 150)
    engine.setProperty('volume', 1.0)
    
    output_path = Path("E:/Senti/backend/tts_speech.wav")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    phrase = "Wake up Senti"
    engine.save_to_file(phrase, str(output_path))
    engine.runAndWait()
    
    print(f"✓ Generated TTS audio: {output_path}")
    print(f"  Phrase: '{phrase}'")

elif use_tts == "gtts":
    print("Using Google Text-to-Speech (requires internet)...\n")
    from gtts import gTTS
    
    phrase = "Wake up Senti"
    tts = gTTS(text=phrase, lang='en', slow=False)
    
    output_path = Path("E:/Senti/backend/gtts_speech.wav")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # gTTS saves as mp3 by default, convert if needed
    mp3_path = output_path.with_suffix('.mp3')
    tts.save(str(mp3_path))
    print(f"✓ Generated TTS audio: {mp3_path}")
    print(f"  Phrase: '{phrase}'")
    print("  (Note: Whisper supports MP3 files)")

print("\nYou can now transcribe any of these files with test_transcribe_speech.py")
