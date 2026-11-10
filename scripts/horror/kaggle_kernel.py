# Runs INSIDE Kaggle (free T4 GPU). Clones the public repo, animates each still with an open image-to-video model,
# and writes mp4 clips to /kaggle/working/clips/<shot>.mp4 for the workflow to download.
import glob, os, subprocess, sys, torch
EP = os.environ.get("EPISODE", "h05-mirror")
REPO = "https://github.com/adhamn75/techalmashi"
MODEL = os.environ.get("I2V_MODEL", "ali-vilab/i2vgen-xl")  # open, not gated
subprocess.run(["pip", "-q", "install", "diffusers", "transformers", "accelerate", "imageio", "imageio-ffmpeg"], check=True)
subprocess.run(["git", "clone", "--depth", "1", REPO, "/kaggle/working/repo"], check=True)
from diffusers import I2VGenXLPipeline
from diffusers.utils import export_to_video, load_image
pipe = I2VGenXLPipeline.from_pretrained(MODEL, torch_dtype=torch.float16, variant="fp16")
pipe.enable_model_cpu_offload()
os.makedirs("/kaggle/working/clips", exist_ok=True)
PROMPT = "slow creepy camera push-in, drifting fog, faint flicker, dark anime horror, nothing else moves"
NEG = "bright, cartoon, cute, blood, gore, text, watermark, distorted, blurry"
for f in sorted(glob.glob(f"/kaggle/working/repo/public/horror/{EP}/stills/*.png")):
    name = os.path.splitext(os.path.basename(f))[0]
    out = f"/kaggle/working/clips/{name}.mp4"
    if os.path.exists(out): continue
    img = load_image(f).convert("RGB").resize((704, 1280))
    gen = torch.manual_seed(7)
    frames = pipe(prompt=PROMPT, image=img, num_inference_steps=30, negative_prompt=NEG,
                  guidance_scale=9.0, generator=gen, num_frames=16, height=1280, width=704).frames[0]
    export_to_video(frames, out, fps=8)
    print("done", name, flush=True)
