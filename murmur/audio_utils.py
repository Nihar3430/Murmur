#murmur/audio_utils.py

import numpy as np
import sounddevice as sd
import soundfile as sf
import time
from collections import deque

def rms_dbfs(x: np.ndarray, eps: float = 1e-9) -> float:
    """Compute RMS in dBFS for a float32 signal in [-1, 1]."""
    x = np.asarray(x, dtype=np.float32)
    rms = np.sqrt(np.mean(np.square(x) + eps))
    db = 20.0 * np.log10(rms + eps)
    return db

def spectral_flux(curr_fft: np.ndarray, prev_fft: np.ndarray) -> float:
    """Half-wave rectified spectral change between two magnitude spectra."""
    diff = np.maximum(curr_fft - prev_fft, 0.0)
    return np.sum(diff)

class ContinuousMic:
    """Low-power continuous monitor that yields audio chunks as numpy arrays."""
    def __init__(self, samplerate=16000, channels=1, chunk_seconds=0.5):
        self.sr = samplerate
        self.channels = channels
        self.chunk = int(self.sr * chunk_seconds)
        self._q = deque()
        self._stream = None

    def _callback(self, indata, frames, time_info, status):
        if status:
            pass
        self._q.append(indata.copy())

    def __enter__(self):
        self._stream = sd.InputStream(
            channels=self.channels,
            samplerate=self.sr,
            blocksize=self.chunk,
            callback=self._callback,
            dtype="float32",
        )
        self._stream.start()
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._stream:
            self._stream.stop()
            self._stream.close()

    def read(self):
        if not self._q:
            time.sleep(0.01)
            return None
        data = self._q.popleft().squeeze()
        return data

def record_seconds(seconds: float, samplerate: int = 16000, channels: int = 1):
    nframes = int(seconds * samplerate)
    rec = sd.rec(nframes, samplerate=samplerate, channels=channels, dtype="float32")
    sd.wait()
    return rec.squeeze()

def write_wav(path: str, audio: np.ndarray, samplerate: int):
    sf.write(path, audio, samplerate)
