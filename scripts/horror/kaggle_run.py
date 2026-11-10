# Driver run by the GitHub workflow: pushes scripts/horror/kaggle_kernel.py to Kaggle, waits, downloads the clips.
import json, os, shutil, subprocess, sys, time
ep = sys.argv[1]
user = os.environ["KAGGLE_USERNAME"]
slug = "horror-i2v"
d = "kaggle_work"; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
src = open("scripts/horror/kaggle_kernel.py").read().replace('"h05-mirror")', f'"{ep}")', 1)
open(f"{d}/kernel.py", "w").write(src)
json.dump({"id": f"{user}/{slug}", "title": "Horror I2V", "code_file": "kernel.py", "language": "python",
           "kernel_type": "script", "is_private": True, "enable_gpu": True, "enable_internet": True,
           "dataset_sources": [], "competition_sources": [], "kernel_sources": []}, open(f"{d}/kernel-metadata.json", "w"))
subprocess.run(["kaggle", "kernels", "push", "-p", d], check=True)
for _ in range(120):  # up to ~2 h
    time.sleep(60)
    s = subprocess.run(["kaggle", "kernels", "status", f"{user}/{slug}"], capture_output=True, text=True).stdout
    print(s.strip(), flush=True)
    if "COMPLETE" in s: break
    if "ERROR" in s or "CANCEL" in s: sys.exit("Kaggle run failed: " + s)
else:
    sys.exit("timed out")
out = f"public/horror/{ep}/clips"; os.makedirs(out, exist_ok=True)
subprocess.run(["kaggle", "kernels", "output", f"{user}/{slug}", "-p", "kaggle_out"], check=True)
for root, _, files in os.walk("kaggle_out"):
    for f in files:
        if f.endswith(".mp4"): shutil.copy(os.path.join(root, f), out)
