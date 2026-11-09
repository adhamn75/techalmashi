"""Generate voice-over lines with the free Microsoft Edge Lebanese voices.

Runs in GitHub Actions (the tts workflow). Reads voice/lines.json:
  {"episode-id": {"voice": "ar-LB-RamiNeural", "rate": "+8%", "lines": ["...", "..."]}}
and writes voice/<episode-id>/<n>.mp3 for each line.
"""
import asyncio
import json
import pathlib

import edge_tts

async def main():
    spec = json.loads(pathlib.Path("voice/lines.json").read_text(encoding="utf-8"))
    for ep, cfg in spec.items():
        out = pathlib.Path("voice") / ep
        out.mkdir(parents=True, exist_ok=True)
        for i, line in enumerate(cfg["lines"]):
            c = edge_tts.Communicate(line, cfg.get("voice", "ar-LB-RamiNeural"), rate=cfg.get("rate", "+0%"))
            await c.save(str(out / f"{i}.mp3"))
            print(ep, i, "ok")

asyncio.run(main())
