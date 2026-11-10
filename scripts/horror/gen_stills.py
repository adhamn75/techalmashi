"""Render horror stills with a free, open model on the GitHub runner's CPU (no keys, no credits).

Model: SimianLuo/LCM_Dreamshaper_v7 (Latent Consistency Model: 4-6 steps, so a 512x896 image takes
~30-60 s on CPU). Reads horror/stills.json and writes public/horror/<episode>/stills/<shot>_<seed>.png,
skipping images that already exist. Writes the model card's licence to stills/MODEL.txt for the record.
"""
import json
import pathlib
import sys
import time

import torch
from diffusers import DiffusionPipeline
from huggingface_hub import model_info

MODEL = "SimianLuo/LCM_Dreamshaper_v7"
spec = json.loads(pathlib.Path("horror/stills.json").read_text(encoding="utf-8"))
only = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None

info = model_info(MODEL)
licence = (info.card_data or {}).get("license", "unknown") if info.card_data else "unknown"
print("model", MODEL, "licence", licence)

torch.set_num_threads(max(1, torch.get_num_threads()))
pipe = DiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float32)
pipe.to("cpu")
pipe.set_progress_bar_config(disable=True)

for ep, cfg in spec["episodes"].items():
    if only and ep != only:
        continue
    out = pathlib.Path("public/horror") / ep / "stills"
    out.mkdir(parents=True, exist_ok=True)
    (out / "MODEL.txt").write_text(f"{MODEL}\nlicence: {licence}\n", encoding="utf-8")
    for shot, prompt in cfg["shots"].items():
        p = prompt.replace("{C}", spec["character"]).replace("{S}", spec["style"])
        for seed in cfg.get("seeds", spec["seeds"]):
            f = out / f"{shot}_{seed}.png"
            if f.exists():
                continue
            t = time.time()
            img = pipe(prompt=p, width=512, height=896, num_inference_steps=6, guidance_scale=8.0,
                       generator=torch.Generator("cpu").manual_seed(seed)).images[0]
            img.save(f)
            print(ep, shot, seed, f"{time.time() - t:.0f}s", flush=True)
