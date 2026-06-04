"""Senti live voice backend.

This process speaks JSON lines over stdin/stdout so Electron can stream
microphone chunks to Faster-Whisper without adding an HTTP server.
"""

from __future__ import annotations

import base64
import json
import sys
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
from faster_whisper import WhisperModel


MODEL_NAME = "base.en"
SAMPLE_RATE = 16000


def emit(event: str, **payload: Any) -> None:
    message = {"event": event, "timestamp": int(time.time() * 1000), **payload}
    print(json.dumps(message), flush=True)


@dataclass
class TranscriptionResult:
    transcript: str
    confidence: float
    language: str


class WhisperService:
    def __init__(self) -> None:
        emit("backend:status", backendConnected=True, modelLoaded=False, message="Loading Faster-Whisper model")
        self.model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
        emit(
            "backend:status",
            backendConnected=True,
            modelLoaded=True,
            model=MODEL_NAME,
            message="Faster-Whisper model loaded",
        )

    def transcribe_pcm16(self, audio_b64: str, sample_rate: int = SAMPLE_RATE) -> TranscriptionResult:
        raw = base64.b64decode(audio_b64)
        if not raw:
            return TranscriptionResult("", 0, "en")

        pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        if sample_rate != SAMPLE_RATE:
            emit("backend:warning", message=f"Expected {SAMPLE_RATE}Hz audio, received {sample_rate}Hz")

        segments, info = self.model.transcribe(
            pcm,
            language="en",
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
        )
        transcript = " ".join(segment.text.strip() for segment in segments).strip()
        confidence = round(float(getattr(info, "language_probability", 0.0)) * 100)
        language = str(getattr(info, "language", "en") or "en")
        return TranscriptionResult(transcript, confidence, language)


def main() -> None:
    service = WhisperService()
    listening = False

    for line in sys.stdin:
        try:
            message = json.loads(line)
            command = message.get("command")

            if command == "voice:start":
                listening = True
                emit("voice:status", listening=True, message="Voice backend listening")
                continue

            if command == "voice:stop":
                listening = False
                emit("voice:status", listening=False, message="Voice backend stopped")
                continue

            if command == "voice:transcribe":
                if not listening:
                    emit("voice:ignored", reason="Voice backend is not listening")
                    continue

                audio = message.get("audio")
                if not isinstance(audio, str) or not audio:
                    emit("voice:error", message="Missing audio payload")
                    continue

                result = service.transcribe_pcm16(audio, int(message.get("sampleRate", SAMPLE_RATE)))
                emit(
                    "voice:transcript",
                    transcript=result.transcript,
                    confidence=result.confidence,
                    language=result.language,
                    chunkId=message.get("chunkId"),
                )
                continue

            emit("backend:warning", message=f"Unknown command: {command}")
        except Exception as exc:
            emit("voice:error", message=str(exc))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        emit("backend:error", backendConnected=False, modelLoaded=False, message=str(exc))
        raise
