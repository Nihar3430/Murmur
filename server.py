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
    # Assumes config.json is in the same directory as server.py
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

# --- GLOBAL ANALYZER STATE ---
app = Flask(__name__)
app.json.ensure_ascii = False
app.json.sort_keys = False

# Set the custom encoder for the Flask app
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
    """Exact match against config + common substrings, case-insensitive."""
    if not name:
        return False
    n = str(name).strip()
    if n in DANGER_LABELS:
        return True
    up = n.upper()
    return (
        "SCREAM" in up or
        "GASP" in up or
        "GUNSHOT" in up or
        "GUNFIRE" in up
    )

def _danger_any_over(res: dict, thresh: float = 0.01) -> bool:
    """
    True if any *danger* label score >= thresh
    Uses event_top_all (preferred) or falls back to event_top.
    """
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
# --- ML ANALYSIS THREAD (UNMODIFIED LOGIC) ---
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
                        # Ensure we store a copy of the result before the thread moves on
                        # Remove audio data and ensure all values are JSON serializable
                        sanitized_result = {k: v for k, v in res.items() if k != 'audio'}
                        last_analysis_result = ensure_json_serializable(sanitized_result)

                    if res and res.get("fired"):
                        print(f"[ALERT FIRED] Score: {res['risk']:.2f}")

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

    # Safely extract the top event label for display
    event_top = res.get("event_top", [])
    top_label = event_top[0] if event_top else {"label": "None", "score": 0.0}

    # Get transcript score safely
    tx_score = res.get('tx_score', 0.0)
    if isinstance(tx_score, np.floating):
        tx_score = float(tx_score)

    # Build response with explicit type conversion
    response_data = {
        "status": "analyzing",
        "risk": float(res['risk']),
        "fired": bool(res['fired']),
        # Tier 1 Trigger: isJump is derived from ML logic (current louder than baseline)
        "isJump": bool(float(res['db']) > float(res['db_baseline'])),
        # Tier 2 Trigger: **danger-only** label >= 0.01
        "isEvent": _danger_any_over(res, 0.01),
        # Tier 3 Trigger: any transcript + high text score
        "isText": bool(res.get('transcript', '').strip() != "" and float(tx_score) >= cfg["nlp"]["text_high_confidence"]),
        "transcript": str(res.get('transcript', '...')),
        "db": float(res['db']),
        "baseline_db": float(res['db_baseline']),
        "event_top": [{"label": str(top_label.get('label', 'None')), "score": float(top_label.get('score', 0.0))}],
        "tx_score": float(tx_score)
    }

    # Ensure everything is JSON serializable before returning
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

    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False)  # Disable debug to avoid double-logging
