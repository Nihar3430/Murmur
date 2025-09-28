# server.py
# This Flask server runs the Murmur ML analysis logic on the laptop's microphone
# and provides JSON updates to the Expo mobile app.

import json
import time
from threading import Thread
import os
import sys
import numpy as np

from flask import Flask, jsonify
# Import your core ML components from the Murmur project
from murmur.continuous import ContinuousAnalyzer, RingMic
# >>> ADDED: we need write_wav to persist the alert snippet
from murmur.audio_utils import write_wav

import io, wave

def _wav_bytes_from_numpy(audio: np.ndarray, sr: int) -> bytes:
    x = np.clip(audio, -1.0, 1.0)
    x_i16 = (x * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(x_i16.tobytes())
    return buf.getvalue()

# --- Custom JSON Encoder for NumPy Types ---
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.bool_):  # Handle numpy bool_ type
            return bool(obj)
        elif isinstance(obj, (np.bool, bool)):  # Handle both numpy and python bools
            return bool(obj)
        return super().default(obj)

def ensure_json_serializable(obj):
    """Recursively convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: ensure_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [ensure_json_serializable(v) for v in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

# ------------------------------------------

# --- CONFIGURATION (Load from config.json) ---
def load_config(path="config.json"):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[FATAL] config.json not found at {path}. Exiting.")
        sys.exit(1)

cfg = load_config()

# Define configuration variables globally from config.json
SR = cfg["audio"]["sample_rate"]
CHUNK_S = cfg["audio"]["chunk_seconds"]
SERVER_PORT = 5000

# Ensure the logging directory exists as soon as module loads
os.makedirs(cfg["logging"]["out_dir"], exist_ok=True)

# --- GLOBAL ANALYZER STATE ---
app = Flask(__name__)
app.json.ensure_ascii = False
app.json.sort_keys = False
app.json_encoder = NpEncoder

analyzer: ContinuousAnalyzer | None = None
mic: RingMic | None = None
running = False
last_analysis_result: dict | None = None

# ----------------------------------------------------------------------
# --- DANGER-ONLY Tier-2 helper (≥ 0.01) ---
# ----------------------------------------------------------------------
DANGER_LABELS = set(cfg["tier2"].get("danger_event_labels", []))

def _is_danger_label(name: str) -> bool:
    if not name:
        return False
    n = str(name).strip()
    if n in DANGER_LABELS:
        return True
    up = n.upper()
    return ("SCREAM" in up or "GASP" in up or "GUNSHOT" in up or "GUNFIRE" in up)

def _danger_any_over(res: dict, thresh: float = 0.01) -> bool:
    tops = res.get("event_top_all") or res.get("event_top") or []
    for t in tops:
        try:
            label = t.get("label", "")
            score = float(t.get("score", 0.0))
            if _is_danger_label(label) and score >= thresh:
                return True
        except Exception:
            pass
    return False

# ----------------------------------------------------------------------
# --- ML ANALYSIS THREAD (SAVES WAV ON ALERT) ---
# ----------------------------------------------------------------------

def analysis_loop():
    global analyzer, mic, running, last_analysis_result

    if not analyzer or not mic:
        print("[ERROR] Analyzer or Mic not initialized.")
        running = False
        return

    print("--- ML Analysis Loop Started ---")

    try:
        with mic:
            print(f"Ambient calibration pending (tick={CHUNK_S}s, win={analyzer.slice_s}s)...")
            while running:
                try:
                    res = analyzer.tick(mic)
                    if res:
                        # Keep JSON-safe copy for /get_analysis
                        sanitized_result = {k: v for k, v in res.items() if k != 'audio'}
                        last_analysis_result = ensure_json_serializable(sanitized_result)

                    # >>> ADDED: Persist WAV snippet whenever an alert fires
                    if res and res.get("fired") and cfg["logging"].get("save_wavs", False):
                        ts = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
                        path = os.path.join(cfg["logging"]["out_dir"], f"event_{ts}.wav")
                        try:
                            write_wav(path, res["audio"], SR)
                            print(f"[ALERT AUDIO SAVED] -> {path}")
                        except Exception as e:
                            print(f"[SAVE ERROR] Could not write WAV: {e}")

                    if res and res.get("fired"):
                        filtered_tops = [
                            event for event in res.get('event_top', [])
                            if float(event.get('score', 0.0)) >= 0.01
                        ]
                        top_str = f"top={filtered_tops}" if filtered_tops else "top=[]"
                        print(f"[ALERT FIRED] Score: {res['risk']:.2f} | {top_str}")

                except Exception as e:
                    print(f"[ERROR] Error during ML tick: {e}")

                time.sleep(analyzer.tick_s)

    except Exception as e:
        print(f"[CRITICAL ERROR] Analysis thread failed (Sounddevice/RingMic issue?): {e}")
        running = False

    print("--- ML Analysis Loop Exited ---")

# ----------------------------------------------------------------------
# --- FLASK ROUTES ---
# ----------------------------------------------------------------------

@app.errorhandler(Exception)
def handle_internal_server_error(e):
    print(f"[FLASK ERROR] Unhandled exception: {e}", file=sys.stderr)
    response_data = {"status": "error", "message": "Internal server error: Check server console log."}
    response_data = ensure_json_serializable(response_data)
    response = jsonify(response_data)
    response.status_code = 500
    return response

from flask import Response

@app.route("/last_snippet.wav", methods=["GET"])
def last_snippet():
    """Return the latest ~5 seconds of audio as a WAV (mono, PCM16)."""
    global mic
    if not running or mic is None:
        return jsonify({"error": "not_running"}), 400
    try:
        x = mic.last(5.0)
        if x is None or len(x) == 0:
            return jsonify({"error": "no_audio"}), 400
        wav = _wav_bytes_from_numpy(np.asarray(x, dtype=np.float32), SR)
        return Response(wav, mimetype="audio/wav")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/start', methods=['POST'])
def start_analysis():
    global analyzer, mic, running, last_analysis_result
    if running:
        return jsonify(ensure_json_serializable({"status": "already_running"})), 200

    try:
        analyzer = ContinuousAnalyzer(cfg)
        mic = RingMic(
            samplerate=SR, channels=1, chunk_seconds=CHUNK_S,
            buffer_seconds=max(8.0, cfg["tier2"].get("spectrogram_window_seconds", 4.0) * 2)
        )

        running = True
        last_analysis_result = None

        # Ensure the output directory exists whenever we start
        os.makedirs(cfg["logging"]["out_dir"], exist_ok=True)

        Thread(target=analysis_loop, daemon=True).start()

        return jsonify(ensure_json_serializable({"status": "starting"})), 200

    except Exception as e:
        print(f"[CRITICAL ERROR] Failed to start ML: {e}")
        running = False
        response_data = {"status": "error", "message": f"ML Initialization Failed: {e}"}
        return jsonify(ensure_json_serializable(response_data)), 500

@app.route('/stop', methods=['POST'])
def stop_analysis():
    global running
    if not running:
        return jsonify(ensure_json_serializable({"status": "not_running"})), 200

    running = False
    print("--- Stopping ML Analysis Loop ---")
    return jsonify(ensure_json_serializable({"status": "stopped"})), 200

@app.route('/get_analysis', methods=['GET'])
def get_analysis():
    global running, last_analysis_result

    if not running:
        response_data = {
            "status": "stopped",
            "risk": 0.0,
            "isJump": False,
            "isEvent": False,
            "isText": False
        }
        return jsonify(ensure_json_serializable(response_data)), 200

    if last_analysis_result is None:
        response_data = {
            "status": "warming_up",
            "risk": 0.0,
            "isJump": False,
            "isEvent": False,
            "isText": False
        }
        return jsonify(ensure_json_serializable(response_data)), 200

    res = last_analysis_result

    event_top = res.get("event_top", [])
    filtered_events = [
        event for event in event_top
        if float(event.get("score", 0.0)) >= 0.01
    ]
    top_label = filtered_events[0] if filtered_events else {"label": "None", "score": 0.0}

    tx_score = res.get('tx_score', 0.0)
    if isinstance(tx_score, np.floating):
        tx_score = float(tx_score)

    response_data = {
        "status": "analyzing",
        "risk": float(res['risk']),
        "fired": bool(res['fired']),
        "isJump": bool(float(res['db']) > float(res['db_baseline'])),
        "isEvent": _danger_any_over(res, 0.01),
        "isText": bool(res.get('transcript', '').strip() != "" and float(tx_score) >= cfg["nlp"]["text_high_confidence"]),
        "transcript": str(res.get('transcript', '...')),
        "db": float(res['db']),
        "baseline_db": float(res['db_baseline']),
        "event_top": [
            {
                "label": str(event.get("label", "None")),
                "score": float(event.get("score", 0.0))
            }
            for event in filtered_events
        ] if filtered_events else [{"label": "None", "score": 0.0}],
        "tx_score": float(tx_score)
    }

    response_data = ensure_json_serializable(response_data)
    return jsonify(response_data), 200

# ----------------------------------------------------------------------
# --- MAIN RUN BLOCK ---
# ----------------------------------------------------------------------

if __name__ == '__main__':
    os.makedirs(cfg["logging"]["out_dir"], exist_ok=True)

    print("---------------------------------------------------------")
    print("--- Murmur ML Server (Active Listener) ---")
    print(f"ML Config: Sample Rate={SR}Hz, Chunk={CHUNK_S}s")
    print(f"Server Host: http://0.0.0.0:{SERVER_PORT}")
    print("---------------------------------------------------------")
    print("!!! Relaunch the Expo app after starting this server. !!!")

    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False)
