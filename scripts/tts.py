"""Generate voice-over lines with the free Microsoft Edge voices.

Runs in GitHub Actions (the tts workflow). Reads voice/lines.json:
  {"episode-id": {"voice": "ar-SA-HamedNeural", "rate": "+15%", "pitch": "+0Hz", "lines": ["...", "..."]}}
and writes, for each line:
  voice/<episode-id>/<n>.mp3         the audio
  voice/<episode-id>/<n>.words.json  word timings [{"w": "...", "start": s, "end": s}] in seconds from the
                                     start of the mp3, for word-by-word captions synced to the voice.
After trimming the leading silence of the mp3, subtract the first word's start to get times in the wav.
"""
import asyncio
import json
import pathlib

import edge_tts


def communicate(line: str, cfg: dict) -> edge_tts.Communicate:
    kw = dict(rate=cfg.get("rate", "+0%"), pitch=cfg.get("pitch", "+0Hz"))
    voice = cfg.get("voice", "ar-SA-HamedNeural")
    try:  # edge-tts >= 7 only sends word boundaries when asked
        return edge_tts.Communicate(line, voice, boundary="WordBoundary", **kw)
    except TypeError:
        return edge_tts.Communicate(line, voice, **kw)


async def main():
    spec = json.loads(pathlib.Path("voice/lines.json").read_text(encoding="utf-8"))
    for ep, cfg in spec.items():
        out = pathlib.Path("voice") / ep
        out.mkdir(parents=True, exist_ok=True)
        for i, line in enumerate(cfg["lines"]):
            audio = bytearray()
            words = []
            async for chunk in communicate(line, cfg).stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    start = chunk["offset"] / 1e7
                    words.append({"w": chunk["text"], "start": round(start, 3), "end": round(start + chunk["duration"] / 1e7, 3)})
            (out / f"{i}.mp3").write_bytes(bytes(audio))
            (out / f"{i}.words.json").write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
            print(ep, i, "ok", len(words), "words")

asyncio.run(main())
