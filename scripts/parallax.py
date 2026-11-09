"""2.5D motion from one still + its depth map (Depth Anything V2): the camera moves *inside* the picture.

usage: parallax.py IMAGE DEPTH OUT.mp4 MODE SECONDS
MODE: dolly (push in, near things grow faster), orbit (gentle side sway), rise (slow tilt up), lunge (fast dolly).
Pure CPU (numpy + OpenCV + ffmpeg); runs on GitHub Actions or locally.
"""
import subprocess
import sys

import cv2
import numpy as np

W, H, FPS = 1080, 1920, 30


def load(img_p, dep_p):
    img = cv2.imread(img_p, cv2.IMREAD_COLOR)
    img = cv2.resize(img, (W, H), interpolation=cv2.INTER_CUBIC)
    d = cv2.imread(dep_p, cv2.IMREAD_GRAYSCALE).astype(np.float32)
    d = cv2.resize(d, (W, H))
    d = cv2.GaussianBlur(d, (0, 0), 6)  # soft edges = no tearing
    d = (d - d.min()) / max(1e-6, d.max() - d.min())  # 1 = near
    return img, d


def ease(t):
    return t * t * (3 - 2 * t)


def main():
    img_p, dep_p, out, mode, secs = sys.argv[1:6]
    img, d = load(img_p, dep_p)
    n = int(float(secs) * FPS)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W / 2, H * 0.45
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                           "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    for i in range(n):
        t = ease(i / max(1, n - 1))
        if mode == "lunge":
            t = min(1.0, (i / max(1, n - 1)) ** 2 * 1.4)
        base = {"dolly": 0.10, "lunge": 0.35, "orbit": 0.05, "rise": 0.06}[mode] * t
        par = {"dolly": 0.08, "lunge": 0.30, "orbit": 0.04, "rise": 0.04}[mode] * t
        sx = {"orbit": 38 * np.sin(t * np.pi * 1.2 - 0.6), "dolly": 10 * t, "lunge": 0, "rise": 0}[mode]
        sy = {"rise": -50 * t, "orbit": 6 * t, "dolly": -8 * t, "lunge": 0}[mode]
        zoom = 1.06 + base + par * d  # near pixels magnify more
        mx = (xs - cx) / zoom + cx - sx * d
        my = (ys - cy) / zoom + cy - sy * d
        frame = cv2.remap(img, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        ff.stdin.write(frame.tobytes())
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
