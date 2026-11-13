"""Trim voice/<ep>/<n>.mp3 into public/voice/<ep>/<n>.wav (CLAUDE.md silence filter) and print the
timeline "voice" entries (src, sec, words with times relative to the trimmed wav), placed back to back.

    python3 scripts/voice_timeline.py <episode> [start_frame] [gap_frames]
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ep = sys.argv[1]
at = int(sys.argv[2]) if len(sys.argv) > 2 else 3
gap = int(sys.argv[3]) if len(sys.argv) > 3 else 8
src, dst = ROOT / "voice" / ep, ROOT / "public" / "voice" / ep
dst.mkdir(parents=True, exist_ok=True)
AF = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
      "silenceremove=start_periods=1:start_threshold=-45dB,areverse")
out = []
for mp3 in sorted(src.glob("*.mp3"), key=lambda p: int(p.stem)):
    wav = dst / f"{mp3.stem}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-af", AF, str(wav)], check=True)
    sec = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
                               capture_output=True, text=True, check=True).stdout)
    words = json.loads((src / f"{mp3.stem}.words.json").read_text(encoding="utf-8"))
    t0 = words[0]["start"] if words else 0
    words = [{"w": w["w"], "start": round(max(0, w["start"] - t0), 3), "end": round(max(0, w["end"] - t0), 3)} for w in words]
    out.append({"src": f"voice/{ep}/{mp3.stem}.wav", "sec": round(sec, 2), "words": words, "at": at})
    at += round(sec * 30) + gap
print(json.dumps(out, ensure_ascii=False))
print("end frame", at, file=sys.stderr)
