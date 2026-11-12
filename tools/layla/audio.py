import json, subprocess, numpy as np, wave
SR = 44100
import os
EP = int(os.environ.get("EP", "2"))
SRC = f"/home/claude/work/ep{EP}/src_h"
OUT = f"/home/claude/work/ep{EP}"
tm = json.load(open(f"{OUT}/timing.json"))
dur = json.load(open(f"{SRC}/dur.json"))
keys = ["n1", "n2", "n3", "n4", "n5", "n6"]
TOTAL = tm["total"]; N = int(TOTAL * SR)
rng = np.random.default_rng(3)
t = np.arange(N) / SR

def load(p):
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                       capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32)

def smooth(x, n):
    k = np.ones(n) / n
    return np.convolve(x, k, mode="same")

# ---- narration with light spooky echo
nar = np.zeros(N, np.float32)
for i, k in enumerate(keys):
    a = load(f"{SRC}/{k}.mp3")
    a = a / (np.abs(a).max() + 1e-6) * 0.9
    wet = np.zeros(len(a) + int(0.5 * SR), np.float32)
    wet[:len(a)] += a
    for d, g in [(0.11, 0.22), (0.23, 0.14), (0.37, 0.08)]:
        o = int(d * SR); wet[o:o + len(a)] += a * g
    s = int(tm["nstart"][i] * SR)
    e = min(N, s + len(wet))
    nar[s:e] += wet[:e - s]
env = smooth(np.abs(nar), int(0.25 * SR)); env = np.clip(env / (env.max() + 1e-6) * 3, 0, 1)

# ---- ambient drone, growing tension
def tone(f, amp, wob=0.0, wf=0.1):
    return amp * np.sin(2 * np.pi * f * t + wob * np.sin(2 * np.pi * wf * t))
drone = tone(55, 0.5, 0.8, 0.07) + tone(82.4, 0.3, 1.2, 0.05) + tone(110.7, 0.18, 2.0, 0.11) + tone(164.8, 0.07, 3, 0.13)
brown = np.cumsum(rng.normal(0, 1, N)); brown = brown - smooth(brown, SR // 2); brown /= np.abs(brown).max()
amb = (drone * 0.55 + brown * 0.25).astype(np.float32)
tension = np.interp(t, [0, tm["starts"][3], tm["starts"][5], TOTAL], [0.55, 0.8, 1.15, 1.2])
amb *= tension * 0.22 * (1 - 0.45 * env)

# ---- heartbeat from scene 4 onward, speeding up
def thump(freq, ln, amp):
    n = int(ln * SR); x = np.arange(n) / SR
    return (amp * np.sin(2 * np.pi * freq * x * (1 - 0.35 * x / ln)) * np.exp(-x * 22)).astype(np.float32)
hb = np.zeros(N, np.float32)
T0 = tm["starts"][3]; bpm_t = T0
while bpm_t < TOTAL - 1.6:
    bpm = np.interp(bpm_t, [T0, tm["starts"][5] + 4], [62, 98])
    for off, amp in [(0.0, 0.9), (0.2, 0.6)]:
        s = int((bpm_t + off) * SR); th = thump(52, 0.35, amp)
        e = min(N, s + len(th))
        if s < N: hb[s:e] += th[:e - s]
    bpm_t += 60.0 / bpm
hb *= 0.55

# ---- sfx
sfx = np.zeros(N, np.float32)
def put(x, at, g=1.0):
    s = int(at * SR); e = min(N, s + len(x))
    if s < N: sfx[s:e] += x[:e - s] * g
# ink scratching in scene 3
for k in range(14):
    n = int(rng.uniform(0.12, 0.3) * SR); x = rng.normal(0, 1, n)
    x = x - smooth(x, 40); x *= np.hanning(n) * rng.uniform(0.3, 0.6)
    put(x.astype(np.float32), tm["nstart"][2] + 1.0 + k * 0.32 + rng.uniform(0, 0.1), 0.18)
# three slow knocks in scene 5
tb = tm["nstart"][4] + dur["n5"] * 0.55
for kk in range(3 if EP == 2 else 0):
    n = int(0.22 * SR); x = np.arange(n) / SR
    kn = (np.sin(2 * np.pi * 95 * x) * 0.9 + rng.normal(0, 0.25, n)) * np.exp(-x * 24)
    put(kn.astype(np.float32), tb + kk * 0.62, 0.9)
# soft notebook rustle in scene 2
for k in range(6):
    n = int(rng.uniform(0.1, 0.25) * SR); x = rng.normal(0, 1, n)
    x = x - smooth(x, 30); x *= np.hanning(n) * 0.4
    put(x.astype(np.float32), tm["nstart"][1] + 0.2 + k * 0.4, 0.15)
# final sting at end card
te = tm["ends"][5] - 1.6
n = int(2.4 * SR); x = np.arange(n) / SR
boom = np.sin(2 * np.pi * 42 * x) * np.exp(-x * 1.6) * 0.9
shim = (np.sin(2 * np.pi * 1318 * x) + np.sin(2 * np.pi * 1397 * x)) * 0.12 * np.exp(-x * 1.2)
put((boom + shim).astype(np.float32), te - 0.1, 0.9)

mix = nar * 1.0 + amb + hb + sfx * 0.9
g = np.minimum(1, np.minimum(t / 0.8, (TOTAL - t) / 1.2))
mix *= g
peak = np.abs(mix).max()
mix = mix / peak * 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open(f"{OUT}/mix.wav", "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("audio ok", round(TOTAL, 2), "peak", round(float(peak), 3))
