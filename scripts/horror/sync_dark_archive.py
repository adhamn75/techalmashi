"""Sync Dark Archive season metadata into the existing TTS and still-image queues."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
season = json.loads((ROOT / "horror/dark_archive_season1.json").read_text(encoding="utf-8"))

voice_path = ROOT / "voice/lines.json"
voice = json.loads(voice_path.read_text(encoding="utf-8"))
for episode in season["episodes"]:
    voice[episode["id"]] = {
        "voice": season["voice"]["name"],
        "rate": season["voice"]["rate"],
        "pitch": season["voice"]["pitch"],
        "lines": episode["lines"],
    }
voice_path.write_text(json.dumps(voice, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

stills_path = ROOT / "horror/stills.json"
stills = json.loads(stills_path.read_text(encoding="utf-8"))
for episode in season["episodes"]:
    stills["episodes"][episode["id"]] = {
        "seeds": [11],
        "shots": {
            name: f"{prompt}, {season['visual_style']}"
            for name, prompt in episode["shots"].items()
        },
    }
stills_path.write_text(json.dumps(stills, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

queue_path = ROOT / "episodes.json"
queue = json.loads(queue_path.read_text(encoding="utf-8"))
known = {item["id"] for item in queue["episodes"]}
for episode in season["episodes"]:
    if episode["id"] in known:
        continue
    source_list = "\n".join(f"- {source}" for source in episode["sources"])
    queue["episodes"].append({
        "id": episode["id"],
        "series": "horror",
        "composition": f"DarkArchive{episode['file']:02d}",
        "title": episode["title"],
        "description": (
            f"{episode['lines'][0]}\n\n"
            f"{episode['status_card']}. مشاهد بصرية مُعاد إنشاؤها لأغراض السرد.\n\n"
            f"المصادر:\n{source_list}\n\n"
            "#الأرشيف_المظلم #رعب_تاريخي #قصص_حقيقية #DarkHistory #HistoricalHorror #shorts"
        ),
        "tags": [
            "الأرشيف المظلم", "رعب تاريخي", "قصص حقيقية", "غموض تاريخي",
            "dark history", "historical horror", "analog horror", "shorts"
        ],
        "synthetic_media": True,
        "status": "draft",
    })
queue_path.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"Synced {len(season['episodes'])} Dark Archive episodes")
