"""Procedural horror sound effects (pure numpy), written to public/sfx/horror/*.wav."""
import numpy as np, wave, pathlib
SR = 44100
OUT = pathlib.Path("public/sfx/horror"); OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)

def save(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def t(sec): return np.arange(int(SR * sec)) / SR
def lowpass(x, a): 
    y = np.zeros_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y

# drone: 12 s low beating sines + filtered noise, slow swell
tt = t(12)
drone = 0.5*np.sin(2*np.pi*55*tt) + 0.4*np.sin(2*np.pi*55.7*tt) + 0.25*np.sin(2*np.pi*82.4*tt + np.sin(2*np.pi*0.1*tt))
drone += 0.3 * lowpass(rng.standard_normal(len(tt)), 0.01)
drone *= np.minimum(1, tt/2) * np.minimum(1, (12-tt)/2)
save("drone", drone)

# heartbeat: lub-dub
def thump(f0, dur):
    x = t(dur); return np.sin(2*np.pi*f0*x*(1 - x)) * np.exp(-x*22)
hb = np.zeros(int(SR*0.9)); a = thump(60, .25); b = thump(52, .25)
hb[:len(a)] += a; hb[int(SR*.22):int(SR*.22)+len(b)] += 0.8*b
save("heartbeat", hb)

# creak: wooden stair, FM sweep with grit
x = t(1.1)
f = 180 + 90*np.sin(2*np.pi*1.3*x) + 40*rng.standard_normal(len(x)).cumsum()/400
creak = np.sign(np.sin(2*np.pi*np.cumsum(f)/SR)) * (0.5 + 0.5*np.sin(2*np.pi*23*x))
creak = lowpass(creak, 0.25) * np.exp(-((x-0.5)**2)/0.08)
save("creak", creak)

# sting: dissonant cluster hit with long tail
x = t(3)
sting = sum(np.sin(2*np.pi*fq*x) for fq in (233, 247, 311, 466, 494)) * np.exp(-x*1.3)
sting += 0.6*rng.standard_normal(len(x))*np.exp(-x*9)
save("sting", sting)

# whisper wind: band noise swell
x = t(4)
wind = lowpass(rng.standard_normal(len(x)), 0.05) - lowpass(rng.standard_normal(len(x)), 0.005)
wind *= np.sin(np.pi*x/4)**2
save("wind", wind)

# flicker: electric buzz bursts
x = t(0.6)
fl = np.sign(np.sin(2*np.pi*100*x)) * (rng.random(len(x)) > 0.5) * ((x*30 % 1) < 0.5)
save("flicker", lowpass(fl.astype(float), 0.3))

# clock tick-tock
x = t(0.05); tick = rng.standard_normal(len(x))*np.exp(-x*200)
save("clock", tick)
print("ok")
