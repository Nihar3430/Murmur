# download_model.py
import os, pathlib, requests

URL = "https://huggingface.co/thelou1s/panns-inference/resolve/main/Cnn14_mAP=0.431.pth?download=true"
OUT = pathlib.Path("audioset/Cnn14_mAP=0.431.pth")
OUT.parent.mkdir(parents=True, exist_ok=True)

if not OUT.exists():
    print("Downloading model…")
    r = requests.get(URL, stream=True)
    r.raise_for_status()
    with open(OUT, "wb") as f:
        for chunk in r.iter_content(1 << 20):
            if chunk: f.write(chunk)
    print("Done.")
else:
    print("Model already present.")
