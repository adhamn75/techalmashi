"""Render today's episodes and schedule them on YouTube.

Runs in GitHub Actions once a day. settings.slots in episodes.json says which series goes out at
which local time (default: one Excel episode, one parents' cybersecurity episode). For each slot it
takes the next "ready" episode of that series, renders it with Remotion, uploads it as a private video
with a scheduled publish time (a review window before it goes public), adds it to the series playlist
when one is set, and marks it "scheduled". It then writes stats.json with every published video's
views/likes/comments so the next batch of ideas can be chosen from real numbers.

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
        client_id="1098334853097-svmse3o063e65tfumg0q23u3cml9mttt.apps.googleusercontent.com",
        client_secret=os.environ["YT_CLIENT_SECRET"].strip(),
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/youtube"],
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


def publish_slots(settings: dict, now: datetime) -> list[tuple[str | None, datetime]]:
    """(series, local publish time) for today's slots; a slot that is <30 min away or past moves to tomorrow."""
    tz = ZoneInfo(settings["timezone"])
    local_now = now.astimezone(tz)
    raw = settings.get("slots") or [{"series": None, "time": t} for t in settings["publish_times"][: settings.get("per_day", 3)]]
    out = []
    for slot in raw:
        h, m = map(int, slot["time"].split(":"))
        t = local_now.replace(hour=h, minute=m, second=0, microsecond=0)
        if t - local_now < timedelta(minutes=30):
            t += timedelta(days=1)
        out.append((slot.get("series"), t))
    return sorted(out, key=lambda x: x[1])


def pick(episodes: list[dict], series: str | None, taken: set[str]) -> dict | None:
    for ep in episodes:
        if ep.get("status") == "ready" and ep["id"] not in taken and (series is None or ep.get("series") == series):
            return ep
    return None


def add_to_playlist(yt, playlist_id: str, video_id: str) -> None:
    yt.playlistItems().insert(part="snippet", body={"snippet": {
        "playlistId": playlist_id, "resourceId": {"kind": "youtube#video", "videoId": video_id}}}).execute()


def write_stats(yt, data: dict) -> None:
    ids = [e["youtube_id"] for e in data["episodes"] if e.get("youtube_id")]
    rows = []
    for i in range(0, len(ids), 50):
        resp = yt.videos().list(part="statistics,snippet,status", id=",".join(ids[i:i + 50])).execute()
        for v in resp.get("items", []):
            st = v.get("statistics", {})
            rows.append({"youtube_id": v["id"], "title": v["snippet"]["title"], "privacy": v["status"]["privacyStatus"],
                         "views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                         "comments": int(st.get("commentCount", 0))})
    by_id = {e.get("youtube_id"): e for e in data["episodes"]}
    for r in rows:
        ep = by_id.get(r["youtube_id"], {})
        r.update(id=ep.get("id"), series=ep.get("series"), publish_at=ep.get("publish_at"))
    rows.sort(key=lambda r: r["views"], reverse=True)
    (ROOT / "stats.json").write_text(json.dumps({"updated": datetime.now(ZoneInfo("UTC")).isoformat(), "videos": rows},
                                                ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"stats.json: {len(rows)} videos")


def main() -> int:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    settings = data["settings"]
    slots = publish_slots(settings, datetime.now(ZoneInfo("UTC")))
    yt = None if DRY_RUN else youtube_client()
    taken: set[str] = set()
    for series, when in slots:
        ep = pick(data["episodes"], series, taken)
        if ep is None:
            print(f"::warning::No ready episode for series '{series}' — slot {when.isoformat()} stays empty.")
            continue
        taken.add(ep["id"])
        path = OUT / f"{ep['id']}.mp4"
        print(f"Rendering {ep['composition']} → {path.name}")
        render(ep["composition"], path)
        if DRY_RUN:
            print(f"[dry run] would schedule {ep['id']} ({series}) for {when.isoformat()}")
            continue
        vid = upload(yt, path, ep, settings, when)
        playlist = (settings.get("playlists") or {}).get(ep.get("series") or "")
        if playlist:
            add_to_playlist(yt, playlist, vid)
        ep.update(status="scheduled", youtube_id=vid, publish_at=when.isoformat())
        print(f"Scheduled {ep['id']} as https://youtu.be/{vid} for {when.isoformat()}")
        QUEUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if yt is not None:
        write_stats(yt, data)
    for series in {s for s, _ in slots if s}:
        left = len([e for e in data["episodes"] if e.get("status") == "ready" and e.get("series") == series])
        if left < 3:
            print(f"::warning::Only {left} ready '{series}' episode(s) left in the queue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
