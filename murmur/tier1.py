#murmur/tier1.py

import numpy as np
import time
from .audio_utils import rms_dbfs, spectral_flux


class Tier1Trigger:
    """Trigger on abrupt loud events using RMS dBFS and spectral flux."""
    def __init__(self, db_threshold=70.0, spectral_flux_threshold=1.8, cooldown_seconds=5.0):
        self.db_threshold = db_threshold
        self.sf_threshold = spectral_flux_threshold
        self.cooldown = cooldown_seconds
        self._last_trigger_t = 0.0
        self._prev_fft = None

    def check(self, chunk: np.ndarray):
        x = np.clip(chunk, -1.0, 1.0).astype(np.float32)
        window = np.hanning(len(x))
        xw = x * window

        db = rms_dbfs(xw)
        fft_mag = np.abs(np.fft.rfft(xw))
        if self._prev_fft is None:
            sf = 0.0
        else:
            sf = spectral_flux(fft_mag, self._prev_fft)
        self._prev_fft = fft_mag

        now = time.time()
        can_trigger = (now - self._last_trigger_t) > self.cooldown

        # db is negative in dBFS; compare to -threshold (e.g., -70 dBFS)
        if db > -self.db_threshold and sf > self.sf_threshold and can_trigger:
            self._last_trigger_t = now
            return True, {"db": float(db), "spectral_flux": float(sf)}
        return False, {"db": float(db), "spectral_flux": float(sf)}
