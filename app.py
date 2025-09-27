#app.py

import json
import os

from murmur.continuous import run_continuous

def load_config(path="config.json"):
    with open(path, "r") as f:
        return json.load(f)

def ensure_dir(p):
    os.makedirs(p, exist_ok=True)

def main():
    cfg = load_config()
    ensure_dir(cfg["logging"]["out_dir"])
    # Single entry point: run continuous demo (DbJump + Event + opportunistic ASR)
    run_continuous(cfg)

if __name__ == "__main__":
    main()
