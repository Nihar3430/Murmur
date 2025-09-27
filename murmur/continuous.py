from __future__ import annotations
import time, threading, queue, os
import numpy as np
from collections import deque
from .audio_utils import rms_dbfs, write_wav
from .tier2 import SpectrogramEventClassifier, TriggerTextJudge


class RingMic:
    """Continuously fills a ring buffer; non-blocking reads of the last N seconds."""
    def __init__(self, samplerate=16000, channels=1, chunk_seconds=0.25, buffer_seconds=8.0):
        import sounddevice as sd
        self.sr = samplerate
        self.ch = channels
        self.chunk = int(self.sr * chunk_seconds)
        self.maxlen = int(self.sr * buffer_seconds)
        self.buf = deque(maxlen=self.maxlen)
        self._sd = sd
        self._stream = None
        self._lock = threading.Lock()

    def _cb(self, indata, frames, time_info, status):
        if status:
            pass
        x = indata[:, 0] if indata.ndim > 1 else indata
        with self._lock:
            self.buf.extend(x.copy())

    def __enter__(self):
        self._stream = self._sd.InputStream(
            channels=self.ch, samplerate=self.sr,
            blocksize=self.chunk, callback=self._cb, dtype="float32"
        )
        self._stream.start()
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._stream:
            self._stream.stop(); self._stream.close()

    def ready(self, need_seconds: float) -> bool:
        with self._lock:
            return len(self.buf) >= int(self.sr * need_seconds)

    def last(self, seconds: float) -> np.ndarray | None:
        n = int(self.sr * seconds)
        with self._lock:
            if len(self.buf) < n:
                return None
            arr = np.array(self.buf, dtype=np.float32)
        return arr[-n:]


class DbJumpMeter:
    """
    Asymmetric EMA baseline tracker for dBFS:

    - If current dB is HIGHER than baseline (room got louder, e.g., -16 -> -6), we raise the baseline SLOWLY.
    - If current dB is LOWER than baseline (room got quieter, e.g., -8 -> -16), we drop the baseline QUICKLY.

    dB are negative in dBFS; "higher"/"louder" means closer to 0. The EMA update form is:

        baseline = alpha * baseline + (1 - alpha) * db

    where alpha_up ~ 0.995 (very slow) for rising baseline, and alpha_down ~ 0.30 (fast) for falling baseline.
    A small deadband avoids micro-oscillation around the baseline.
    """
    def __init__(
        self,
        ema_alpha_up: float = 0.995,   # very slow rise toward louder ambient
        ema_alpha_down: float = 0.30,  # fast drop toward quieter ambient
        deadband_db: float = 0.25      # ignore tiny wiggles within ±deadband
    ):
        # clamp params to sane ranges
        self.alpha_up = float(min(max(ema_alpha_up, 0.0), 0.999999))
        self.alpha_down = float(min(max(ema_alpha_down, 0.0), 0.999999))
        self.deadband = float(max(deadband_db, 0.0))
        self.baseline_db: float | None = None

    def seed(self, db_seed: float):
        self.baseline_db = float(db_seed)

    def _update_baseline(self, db: float):
        if self.baseline_db is None:
            self.baseline_db = db
            return

        base = self.baseline_db
        # Decide direction with deadband
        if db > base + self.deadband:
            # Room got louder -> raise baseline slowly (alpha_up ~ 0.995)
            alpha = self.alpha_up
            self.baseline_db = alpha * base + (1.0 - alpha) * db
        elif db < base - self.deadband:
            # Room got quieter -> drop baseline quickly (alpha_down ~ 0.30)
            alpha = self.alpha_down
            self.baseline_db = alpha * base + (1.0 - alpha) * db
        else:
            # Within deadband: keep baseline unchanged to prevent jitter
            self.baseline_db = base

    def score(self, x: np.ndarray, clip_lo=3.0, clip_hi=18.0) -> tuple[float, float, float]:
        """
        Returns (jump_score_0_1, current_db, baseline_db).

        jump_score is computed from positive delta (current louder than baseline),
        mapped linearly from [clip_lo..clip_hi] dB to [0..1].
        """
        db = rms_dbfs(x)

        # Asymmetric baseline tracking
        self._update_baseline(db)
        base = float(self.baseline_db)

        # Positive jump only (how much louder than baseline, in dB)
        delta = max(0.0, db - base)

        # Normalize to 0..1 using the clip window
        s = (delta - clip_lo) / (clip_hi - clip_lo)
        s = 0.0 if s < 0 else (1.0 if s > 1 else s)

        return float(s), float(db), float(base)


class AsyncASR:
    """Single-worker background ASR so ticks never block."""
    def __init__(self, transcriber: TriggerTextJudge, sr: int):
        self.tx = transcriber
        self.sr = sr
        self.q: queue.Queue[tuple[np.ndarray, float, str]] = queue.Queue(maxsize=1)  # (audio, t_submit, reason)
        self.last_result: dict | None = None
        self._stop = False
        self._th = threading.Thread(target=self._loop, daemon=True)
        self._th.start()

    def _loop(self):
        while not self._stop:
            try:
                audio, t_submit, reason = self.q.get(timeout=0.1)
            except queue.Empty:
                continue
            try:
                transcript = self.tx.transcribe(audio, self.sr)
                judged = self.tx.judge(transcript)
                # Only the LLM decides; no hotword boosts here.
                tx_score = float(judged.get("confidence", 0.0)) if judged.get("decision", "SAFE") == "DANGER" else 0.0
                self.last_result = {
                    "t": float(time.time()),
                    "transcript": str(transcript),
                    "tx_score": float(tx_score),
                    "judge": judged,
                    "reason": str(reason)
                }
                print(f"[ASR-bg] done (reason: {reason}); tx={tx_score:.2f} judge={judged}")
                if transcript:
                    # Print the transcript exactly once per ASR completion.
                    print(f"  transcript: {transcript}")
            except Exception as e:
                self.last_result = {
                    "t": float(time.time()),
                    "transcript": "",
                    "tx_score": 0.0,
                    "judge": {"decision": "SAFE", "confidence": 0.5, "reason": f"ASR error: {e}"},
                    "reason": str(reason)
                }

    def maybe_submit(self, audio: np.ndarray, reason: str) -> bool:
        """Try to queue audio; returns True if queued."""
        if self.q.full():
            return False
        try:
            self.q.put_nowait((audio.copy(), time.time(), reason))
            print(f"[ASR-bg] queued ({reason})")
            return True
        except queue.Full:
            return False

    def snapshot(self) -> dict | None:
        return self.last_result

    def stop(self):
        self._stop = True
        try:
            self._th.join(timeout=0.5)
        except Exception:
            pass


class ContinuousAnalyzer:
    """Runs event model + opportunistic ASR (jump/event only) + dB jump; prints ticks and returns alerts."""
    def __init__(self, cfg):
        self.cfg = cfg
        self.sr = cfg["audio"]["sample_rate"]
        self.slice_s = cfg["tier2"].get("spectrogram_window_seconds", 4.0)
        self.tick_s = cfg["audio"].get("chunk_seconds", 0.5)

        # models
        self.event = SpectrogramEventClassifier(model_name=cfg["tier2"]["event_model"])
        self.text = TriggerTextJudge(
            whisper_model=cfg["nlp"]["transcribe_model"],
            llm_model=cfg["nlp"]["llm_model"],
            use_fireworks_asr=cfg["nlp"].get("use_fireworks_asr", False),
            fireworks_model=cfg["nlp"].get("fireworks_model", "whisper-v3-turbo"),
            fireworks_endpoint=cfg["nlp"].get("fireworks_endpoint")
        )
        self.asr_bg = AsyncASR(self.text, self.sr)

        # meters / weights
        # NOTE: DbJumpMeter now uses asymmetric EMA (slow up / fast down)
        up_alpha   = cfg["audio"].get("db_base_up_alpha", 0.995)
        down_alpha = cfg["audio"].get("db_base_down_alpha", 0.30)
        deadband   = cfg["audio"].get("db_base_deadband_db", 0.25)
        self.dbjump = DbJumpMeter(ema_alpha_up=up_alpha, ema_alpha_down=down_alpha, deadband_db=deadband)

        self.w_event = 0.55
        self.w_text  = 0.35
        self.w_jump  = 0.10

        # thresholds
        self.alert_min       = cfg["tier3"]["alert_min_score"]
        self.event_gate      = cfg["tier2"].get("event_min_confidence", 0.35)
        self.asr_jump_min    = cfg["audio"].get("asr_jump_min", 0.25)
        self.text_hi_conf    = cfg["nlp"].get("text_high_confidence", 0.8)
        self.text_override   = cfg["nlp"].get("alert_on_text_high_conf", True)
        self.text_hold_s     = cfg["nlp"].get("text_hold_seconds", 6.0)  # how long a text hit influences risk

        # --- NEW: safe-label preemption (config driven) ---
        self.safe_labels  = set(cfg["tier2"].get("safe_event_labels", ["Applause","Cheering","Fireworks"]))
        self.safe_gate    = float(cfg["tier2"].get("safe_preempt_threshold", 0.009))
        self.safe_margin  = float(cfg["tier2"].get("safe_preempt_margin", 0.003))
        # ---------------------------------------------------

        # state
        self.smooth = deque(maxlen=4)  # ~2s smoothing at 0.5s ticks
        self.cooldown_s = 6.0
        self._last_alert = 0.0
        self._warmed = False

    def _risk_from_event(self, event_pred: dict) -> float:
        """
        Compute Tier-2 risk from PANNs tops, with SAFE preemption.

        - Danger: Screaming/Gasp/Gunshot (by exact list or obvious substring)
        - Safe preemption: if a safe label (Applause/Cheering/Fireworks) is
          confident and ahead of danger by a margin, suppress Tier-2 risk (0.0).
        """
        danger = set(self.cfg["tier2"]["danger_event_labels"])

        danger_max = 0.0
        safe_max = 0.0

        tops = event_pred.get("top_labels", [])
        for it in tops:
            lab = str(it["label"]); sc = float(it["score"])

            # treat these as danger either by exact list or obvious substring
            if any(k in lab for k in ["Scream", "Screaming", "Gunshot", "Gasp"]) or lab in danger:
                danger_max = max(danger_max, sc)

            # safe allowlist (exact or obvious)
            if (lab in self.safe_labels) or any(k in lab for k in ["Applause", "Cheering", "Fireworks"]):
                safe_max = max(safe_max, sc)

        # If a safe label is confident AND clearly beats danger, suppress Tier-2 risk
        if (safe_max >= self.safe_gate) and (safe_max >= danger_max + self.safe_margin):
            return 0.0

        return float(danger_max)

    def _text_score_fresh(self, last_asr: dict | None, now: float) -> tuple[float, str]:
        if not last_asr:
            return 0.0, ""
        age = now - float(last_asr.get("t", 0.0))
        tx = float(last_asr.get("tx_score", 0.0))
        transcript = str(last_asr.get("transcript", ""))
        # hard drop after hold window (simple + predictable)
        if age > self.text_hold_s:
            return 0.0, transcript
        return float(tx), transcript

    def tick(self, mic: RingMic) -> dict | None:
        # warm-up to seed baseline and avoid -90 dBFS on first tick
        if not mic.ready(self.slice_s):
            print("[Warmup] filling buffer…")
            return None
        if not self._warmed:
            x0 = mic.last(self.slice_s)
            if x0 is None:
                return None
            db0 = rms_dbfs(x0)
            self.dbjump.seed(db0)
            self._warmed = True
            print(f"Ambient calibrated: amb_db≈{db0:.1f} dBFS  |  Mode=CONT  |  tick={self.tick_s:.2f}s  |  win={self.slice_s:.2f}s")
            return None

        x = mic.last(self.slice_s)
        if x is None:
            return None

        # event model (fast)
        ev = self.event.predict(x, self.sr)
        ev_s = self._risk_from_event(ev)

        # dB jump
        j_s, db, base_db = self.dbjump.score(x)

        # latest ASR result (non-blocking) with age gating
        now = time.time()
        last_asr = self.asr_bg.snapshot()
        tx_s, transcript = self._text_score_fresh(last_asr, now)

        # weighted risk + optional text override
        risk = self.w_event * ev_s + self.w_text * tx_s + self.w_jump * j_s
        if self.text_override and tx_s >= self.text_hi_conf:
            risk = max(risk, 1.00)  # lift floor to pass typical alert threshold

        # smooth & alerting
        self.smooth.append(risk)
        risk_sm = float(np.mean(self.smooth))
        fired = False
        if risk_sm >= self.alert_min and (now - self._last_alert) > self.cooldown_s:
            fired = True
            self._last_alert = now

        # ------ ASR launch policy: NO CADENCE ------
        launched = False
        if ev_s >= self.event_gate:
            launched = self.asr_bg.maybe_submit(x, "event")
        elif j_s >= self.asr_jump_min:
            launched = self.asr_bg.maybe_submit(x, "jump")
        # ------------------------------------------

        if launched:
            print("[ASR-bg] launched (pending)…")
        else:
            print("[ASR-bg] no result yet")

        # --------- Top labels for server/ui ----------
        # Original tops from the model:
        ev_top_all = [{"label": str(item["label"]), "score": float(item["score"])}
                      for item in ev.get("top_labels", [])]

        # Danger-only tops (for driving the mobile 'isEvent' via server.py)
        danger = set(self.cfg["tier2"]["danger_event_labels"])
        danger_tops = [
            t for t in ev_top_all
            if (t["label"] in danger) or any(k in t["label"] for k in ["Scream", "Screaming", "Gunshot", "Gasp"])
        ]
        danger_tops.sort(key=lambda d: d["score"], reverse=True)

        # If safe preemption happened (ev_s==0 due to strong safe), make sure we DO NOT
        # return a high-scoring safe label as top[0] to the server. Otherwise server.py
        # would set isEvent=True. Prefer danger list if available, else a neutral placeholder.
        if ev_s == 0.0:
            top_for_server = danger_tops[:3] if danger_tops else [{"label": "None", "score": 0.0}]
        else:
            # If we have danger tops, prefer them; else fall back to whatever the model had.
            top_for_server = (danger_tops[:3] if danger_tops else ev_top_all[:3])

        print(
            f"[Tick] db={db:.1f} dBFS base={base_db:.1f} | ev={ev_s:.2f} tx={tx_s:.2f} jump={j_s:.2f} "
            f"=> risk={risk:.2f} ~ {risk_sm:.2f} | top={top_for_server[:2]} "
            f"{'ALERT!' if fired else ''}"
        )
        # Transcript prints once in AsyncASR._loop
        # --------------------------------------------

        # Ensure all return values are native Python types for JSON serialization
        return {
            "risk": float(risk_sm),
            "fired": bool(fired),
            "event_top": top_for_server,          # what the server/mobile uses
            "event_top_all": ev_top_all[:3],      # optional: full tops for debugging/UI
            "db": float(db),
            "db_baseline": float(base_db),
            "transcript": str(transcript),
            "tx_score": float(tx_s),
            "audio": x,
        }


def run_continuous(cfg):
    """Entry for continuous demo; saves WAV when an alert fires."""
    sr = cfg["audio"]["sample_rate"]
    ch = cfg["audio"]["channels"]
    chunk_s = cfg["audio"]["chunk_seconds"]
    out_dir = cfg["logging"]["out_dir"]
    os.makedirs(out_dir, exist_ok=True)

    analyzer = ContinuousAnalyzer(cfg)

    print("Murmur Safety (continuous): listening... (Ctrl+C to stop)")
    with RingMic(
        samplerate=sr, channels=ch, chunk_seconds=chunk_s,
        buffer_seconds=max(8.0, cfg["tier2"].get("spectrogram_window_seconds", 4.0) * 2)
    ) as mic:
        try:
            while True:
                res = analyzer.tick(mic)
                if res and res.get("fired") and cfg["logging"]["save_wavs"]:
                    ts = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
                    path = os.path.join(out_dir, f"event_{ts}.wav")
                    write_wav(path, res["audio"], sr)
                    print(f"Saved snippet -> {path}")
                time.sleep(analyzer.tick_s)
        except KeyboardInterrupt:
            analyzer.asr_bg.stop()
            print("Stopped.")
