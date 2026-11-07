"""Build the one-shot SFX in public/sfx/ with the procedural engine in sfx/ (from whaleyxbt/claude-motion).

Each <Sfx name="..."> in an episode plays one of these files. Everything is synthesized, so it's
license-free and identical on every run. Tonal sounds stay in C major so a sequence never clashes.
Run:  python3 scripts/make_sfx.py
"""
import os
import struct
import sys
import wave

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sfx import synth  # noqa: E402
from sfx.synth import SR  # noqa: E402

C5, E5, G5, C6 = 523.25, 659.25, 783.99, 1046.5

SOUNDS = {
    "pop": lambda: synth.pop(700, 1300),
    "whoosh": lambda: synth.whoosh(0.4, 500, 2600, peak=0.45),
    "tick": lambda: synth.click(2200),
    "click": lambda: synth.click(1500),
    "blip": lambda: synth.blip(G5, dur=0.3),
    "ding": lambda: synth.chime([C5, E5, G5, C6], dur=1.4),
    "buzz": lambda: synth.impact(dur=0.7),
}


def write(path, samples, peak=0.6):
    m = max(1e-9, max(abs(s) for s in samples))
    k = peak / m
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples))


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "sfx")
    os.makedirs(out, exist_ok=True)
    for name, make in SOUNDS.items():
        write(os.path.join(out, f"{name}.wav"), make(), peak=0.75 if name in ("buzz", "ding") else 0.6)
        print("wrote", name)
