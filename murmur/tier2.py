# murmur/tier2.py

from __future__ import annotations
import os, json, warnings, re, csv
import requests
import numpy as np
import librosa

# --------------------------- keyword fallback (unused in judge, kept for ref) ---------------------------
DANGER_FALLBACK_KEYWORDS = {
    "scream","screaming","gasp","gasping",
    "help","fire","police","stop","get off me","call 911",
    "gunshot","gun","shoot","knife","run"
}

# --------------------------- Fireworks Chat (Qwen Instruct) ---------------------------
FIREWORKS_CHAT_URL = "https://api.fireworks.ai/inference/v1/chat/completions"


class TriggerTextJudge:
    """
    Transcribe (Fireworks ASR or local Whisper) + classify via Fireworks Qwen Instruct.

    judge() returns one of:
      { "decision": "DANGER"|"SAFE", "confidence": float, "reason": str }

    Notes:
    - We DO NOT load any local transformers model. The `llm_model` string is the Fireworks remote model id.
    - If `use_fireworks_asr` is False, we fall back to local whisper.
    """
    def __init__(self,
                 whisper_model: str = "base",
                 llm_model: str = "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
                 use_fireworks_asr: bool = False,
                 fireworks_model: str = "whisper-v3-turbo",
                 fireworks_endpoint: str | None = None,
                 fireworks_api_key: str = "fw_3ZPbgQntdima4xmbkpjUbSdc",
                 device: str | None = None):
        self.use_fireworks = use_fireworks_asr
        self.llm_model = llm_model
        self.api_key = (fireworks_api_key or os.getenv("FIREWORKS_API_KEY") or "").strip()
        if not self.api_key:
            raise ValueError("Missing FIREWORKS_API_KEY for Fireworks LLM judge.")

        if self.use_fireworks:
            # Use Fireworks serverless ASR
            from .fireworks_asr import FireworksTranscriber
            self.asr_remote = FireworksTranscriber(
                api_key=self.api_key,
                model=fireworks_model,
                endpoint=fireworks_endpoint
            )
            self.asr = None
        else:
            # Local Whisper fallback
            import whisper
            self.asr = whisper.load_model(whisper_model)
            self.asr_remote = None

    # --------------------------- transcription ---------------------------
    def transcribe(self, audio: np.ndarray, sr: int) -> str:
        if self.use_fireworks:
            return self.asr_remote.transcribe(audio, sr)
        if sr != 16000:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        result = self.asr.transcribe(audio, fp16=False)
        return result.get("text", " ").strip()

    # --------------------------- classification via Fireworks Qwen ---------------------------
    def _classify_remote(self, transcript: str, max_tokens: int = 4, temperature: float = 0.0) -> str:
        """
        Calls Fireworks chat/completions with a one-word instruction. Returns raw model text.
        """
        prompt = f"""Classify a live-mic transcript. If it clearly describes a real, ongoing dangerous situation
(here/now: imminent harm, active threat, a weapon being used), answer DANGER.
If it's a reference, quote, joke, news, or a game (not happening here/now), answer SAFE.

Transcript: {transcript!r}

Answer with exactly one word: DANGER or SAFE."""
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.llm_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": 1.0,
        }
        r = requests.post(FIREWORKS_CHAT_URL, headers=headers, data=json.dumps(payload), timeout=20)
        r.raise_for_status()
        return (r.json()["choices"][0]["message"]["content"] or "").strip()

    def judge(self, transcript: str) -> dict:
        """
        Minimal protocol: ask the LLM for exactly one word: DANGER or SAFE.
        Parse the first occurrence case-insensitively; if not parseable, default SAFE.
        """
        t = (transcript or "").strip()
        if not t:
            return {"decision": "SAFE", "confidence": 0.5, "reason": "Empty transcript"}

        try:
            out = self._classify_remote(t, max_tokens=4, temperature=0.0)
        except Exception as e:
            # Fail-safe: on remote error, return SAFE (and surface reason)
            return {"decision": "SAFE", "confidence": 0.5, "reason": f"LLM error: {e}"}

        m = re.search(r"\b(DANGER|SAFE)\b", out, flags=re.I)
        if not m:
            # ultra-robust fallback: try to coerce obvious prefixes
            up = out.strip().upper()
            if up.startswith("DANG"):
                decision = "DANGER"
            elif up.startswith("SAFE"):
                decision = "SAFE"
            else:
                return {"decision": "SAFE", "confidence": 0.5, "reason": "Unparseable; default SAFE"}
        else:
            decision = m.group(1).upper()

        # Confidence: crisp in this mode; tune if desired
        conf = 1.0 if decision == "DANGER" else 0.8
        return {"decision": decision, "confidence": conf, "reason": "one-word mode"}

# --------------------------- Audio event classifier (unchanged API) ---------------------------

def _load_audioset_labels(csv_path: str) -> list[str]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"AudioSet labels CSV not found: {csv_path}")
    idx2name = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for row in rd:
            idx = int(row["index"])
            name = row["display_name"].strip().strip('"')
            idx2name[idx] = name
    return [idx2name[i] for i in sorted(idx2name.keys())]


class SpectrogramEventClassifier:
    """
    PANNs CNN14 via panns-inference (no auto-downloads).

    Required local files:
      - audioset/Cnn14_mAP=0.431.pth          (or env PANNS_CNN14_CHECKPOINT)
      - audioset/class_labels_indices.csv     (or env AUDIOSET_LABELS_CSV)
    """
    def __init__(self, model_name: str = "panns_cnn14", device: str | None = None, model_dir: str = "models"):
        # torch is only needed if PANNs is present
        import torch
        self.device = torch.device(device) if device else torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.available = False
        self.labels: list[str] = []
        self.checkpoint_path = os.getenv("PANNS_CNN14_CHECKPOINT", os.path.join("audioset", "Cnn14_mAP=0.431.pth"))
        self.labels_csv     = os.getenv("AUDIOSET_LABELS_CSV",    os.path.join("audioset", "class_labels_indices.csv"))
        self._init_panns()

    def _init_panns(self):
        try:
            self.labels = _load_audioset_labels(self.labels_csv)
            from panns_inference import AudioTagging
            if not os.path.exists(self.checkpoint_path):
                raise FileNotFoundError(
                    f"Missing CNN14 checkpoint at '{self.checkpoint_path}'. "
                    f"Download 'Cnn14_mAP=0.431.pth' and place it there "
                    f"(or set PANNS_CNN14_CHECKPOINT)."
                )
            self.at = AudioTagging(checkpoint_path=self.checkpoint_path, device="cuda" if self.device.type=="cuda" else "cpu")
            self.available = True
        except Exception as e:
            warnings.warn(f"PANNs CNN14 failed to load: {e}")
            self.available = False

    def _panns_predict(self, audio: np.ndarray, sr: int) -> dict:
        y = np.asarray(audio, dtype=np.float32).squeeze()
        if sr != 32000:
            y = librosa.resample(y, orig_sr=sr, target_sr=32000)
        y = np.clip(y, -1.0, 1.0).astype(np.float32)
        x = y[None, :]
        out = self.at.inference(x)
        if isinstance(out, tuple):
            clipwise_output = out[0]
        elif isinstance(out, dict):
            clipwise_output = out["clipwise_output"]
        else:
            raise RuntimeError(f"Unexpected PANNs output type: {type(out)}")
        clip = out[0] if isinstance(out, tuple) else clipwise_output
        if hasattr(clip, "detach"):
            clip = clip.detach().cpu().numpy()
        clip = np.asarray(clip)
        if clip.ndim == 2:
            clip = clip[0]
        else:
            clip = clip.reshape(-1)

        C = min(len(self.labels), clip.shape[-1])
        probs = {self.labels[i]: float(clip[i]) for i in range(C)}

        focus = ["Screaming", "Gasp", "Cheering", "Applause"]
        tops = [(lab, probs.get(lab, 0.0)) for lab in focus]
        if all(s <= 0.0 for _, s in tops):
            idxs = np.argsort(clip)[:-(5+1):-1]
            tops = [(self.labels[i], float(clip[i])) for i in idxs]
        tops.sort(key=lambda x: x[1], reverse=True)
        return {"top_labels": [{"label": n, "score": float(s)} for n, s in tops[:5]], "raw": {"probs": probs}}

    def predict(self, audio: np.ndarray, sr: int = 16000) -> dict:
        if self.available:
            try:
                return self._panns_predict(audio, sr)
            except Exception as e:
                warnings.warn(f"PANNs inference failed: {e}")

        # Lightweight fallback if PANNs isn't available
        S = np.abs(librosa.stft(audio, n_fft=1024, hop_length=256)) + 1e-9
        centroid = float(librosa.feature.spectral_centroid(S=S).mean())
        zcr = float(librosa.feature.zero_crossing_rate(audio).mean())
        rolloff = float(librosa.feature.spectral_rolloff(S=S, roll_percent=0.85).mean())
        score = max(0.0, min((centroid/4000.0)*0.4 + zcr*0.4 + (rolloff/6000.0)*0.2, 1.0))
        return {"top_labels": [{"label": "Scream_like", "score": score}],
                "raw": {"centroid": centroid, "zcr": zcr, "rolloff": rolloff}}
