"""Render today's episodes and schedule them on YouTube.

Runs in GitHub Actions once a day. For each publish time in episodes.json it takes the
next episode with status "ready", renders it with Remotion, uploads it as a private video
with a scheduled publish time (so there is a review window before it goes public),
and marks it "scheduled" in episodes.json.

Secrets (GitHub → Settings → Secrets and variables → Actions):
  YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN   (from scripts/auth_setup.py)
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
QUEUE = ROOT / "episodes.json"
OUT = ROOT / "out"
DRY_RUN = os.environ.get("DRY_RUN") == "1"


def youtube_client():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id=os.environ["YT_CLIENT_ID"],
        client_secret=os.environ["YT_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/youtube.upload"],
    )
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def render(composition: str, path: Path) -> None:
    OUT.mkdir(exist_ok=True)
    tmp = path.with_name(path.stem + ".partial.mp4")
    subprocess.run(
        ["npx", "remotion", "render", "src/index.ts", composition, str(tmp),
         "--gl=swangle", "--codec=h264", "--crf=18", "--x264-preset=veryfast"],
        cwd=ROOT, check=True,
    )
    tmp.replace(path)


def upload(yt, path: Path, ep: dict, settings: dict, publish_at: datetime) -> str:
    from googleapiclient.http import MediaFileUpload

    body = {
        "snippet": {
            "title": ep["title"][:100],
            "description": ep["description"],
            "tags": ep.get("tags", []),
            "categoryId": settings.get("category_id", "27"),
            "defaultLanguage": settings.get("language", "ar"),
            "defaultAudioLanguage": settings.get("language", "ar"),
        },
        "status": {
            "privacyStatus": "private",
            "publishAt": publish_at.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "selfDeclaredMadeForKids": False,
            "containsSyntheticMedia": False,
        },
    }
    media = MediaFileUpload(str(path), mimetype="video/mp4", resumable=True, chunksize=8 * 1024 * 1024)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    return resp["id"]


def publish_slots(settings: dict, now: datetime) -> list[datetime]:
    tz = ZoneInfo(settings["timezone"])
    local_now = now.astimezone(tz)
    slots = []
    for hhmm in settings["publish_times"][: settings.get("per_day", 3)]:
        h, m = map(int, hhmm.split(":"))
        t = local_now.replace(hour=h, minute=m, second=0, microsecond=0)
        if t - local_now < timedelta(minutes=30):  # too close or already passed → tomorrow
            t += timedelta(days=1)
        slots.append(t)
    return sorted(slots)


def main() -> int:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    settings = data["settings"]
    ready = [e for e in data["episodes"] if e.get("status") == "ready"]
    slots = publish_slots(settings, datetime.now(ZoneInfo("UTC")))

    if not ready:
        print("::warning::No episodes with status 'ready' — nothing to publish today.")
        return 0

    yt = None if DRY_RUN else youtube_client()
    for ep, when in zip(ready, slots):
        path = OUT / f"{ep['id']}.mp4"
        print(f"Rendering {ep['composition']} → {path.name}")
        render(ep["composition"], path)
        if DRY_RUN:
            print(f"[dry run] would schedule {ep['id']} for {when.isoformat()}")
            continue
        vid = upload(yt, path, ep, settings, when)
        ep.update(status="scheduled", youtube_id=vid, publish_at=when.isoformat())
        print(f"Scheduled {ep['id']} as https://youtu.be/{vid} for {when.isoformat()}")
        QUEUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    left = len([e for e in data["episodes"] if e.get("status") == "ready"])
    if left < settings.get("per_day", 3):
        print(f"::warning::Only {left} ready episode(s) left in the queue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
