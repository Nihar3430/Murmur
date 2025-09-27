# murmur/fireworks_asr.py

import os
import io
import wave
import numpy as np
import requests

DEFAULT_FIREWORKS_ASR_ENDPOINT = "https://audio-turbo.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions"


def _wav_bytes_from_numpy(audio: np.ndarray, sr: int) -> bytes:
    """Convert float32 [-1,1] mono to in-memory PCM16 WAV bytes."""
    x = np.clip(audio, -1.0, 1.0)
    x_i16 = (x * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(x_i16.tobytes())
    return buf.getvalue()


class FireworksTranscriber:
    """
    Fireworks serverless ASR wrapper.

    Requires FIREWORKS_API_KEY in the environment.
    Optional override: FIREWORKS_ASR_ENDPOINT
    """
    def __init__(self, api_key: str | None = None, model: str = "whisper-v3-turbo", endpoint: str | None = None):
        self.api_key = (api_key or os.getenv("FIREWORKS_API_KEY") or "").strip()
        if not self.api_key:
            raise ValueError("Missing FIREWORKS_API_KEY for Fireworks ASR.")
        self.model = model
        self.endpoint = endpoint or os.getenv("FIREWORKS_ASR_ENDPOINT", DEFAULT_FIREWORKS_ASR_ENDPOINT)

    def transcribe(self, audio: np.ndarray, sr: int, temperature: float = 0.0, vad_model: str = "silero") -> str:
        wav_bytes = _wav_bytes_from_numpy(audio, sr)
        files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
        data = {"model": self.model, "temperature": str(temperature), "vad_model": vad_model}
        headers = {"Authorization": f"Bearer {self.api_key}"}
        resp = requests.post(self.endpoint, headers=headers, files=files, data=data, timeout=60)
        if resp.status_code != 200:
            raise RuntimeError(f"Fireworks ASR error {resp.status_code}: {resp.text[:500]}")
        js = resp.json()
        text = js.get("text") or js.get("data") or js
        if isinstance(text, dict) and "text" in text:
            text = text["text"]
        return (text or "").strip()
