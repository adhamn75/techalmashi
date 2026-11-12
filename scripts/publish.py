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
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
QUEUE = ROOT / "episodes.json"
OUT = ROOT / "out"
DRY_RUN = os.environ.get("DRY_RUN") == "1"


def refresh_token(account: str = "tech") -> str:
    """Decrypt the account's token file (youtube_token.enc for tech3almashi, youtube_token_<account>.enc otherwise)."""
    if account == "tech" and os.environ.get("YT_REFRESH_TOKEN"):
        return os.environ["YT_REFRESH_TOKEN"]
    f = ROOT / ("youtube_token.enc" if account == "tech" else f"youtube_token_{account}.enc")
    if not f.exists():
        raise FileNotFoundError(f"{f.name} missing: run the Connect YouTube workflow for account '{account}'")
    out = subprocess.run(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-a", "-A", "-pass", "env:YT_CLIENT_SECRET",
                          "-in", str(f)], capture_output=True, text=True, check=True)
    return out.stdout.strip()


def youtube_client(account: str = "tech"):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=refresh_token(account),
        client_id="1098334853097-svmse3o063e65tfumg0q23u3cml9mttt.apps.googleusercontent.com",
        client_secret=os.environ["YT_CLIENT_SECRET"].strip(),
        token_uri="https://oauth2.googleapis.com/token",
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
            "categoryId": (settings.get("categories") or {}).get(ep.get("series") or "", settings.get("category_id", "27")),
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


def _norm(title: str) -> str:
    return " ".join(title.replace("#shorts", "").split()).strip().lower()


def channel_uploads(yt) -> list[dict]:
    """Every video on the account's channel (public, private or scheduled) with its title and views."""
    ch = yt.channels().list(part="contentDetails", mine=True).execute()["items"][0]
    pl = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, token = [], None
    while True:
        r = yt.playlistItems().list(part="contentDetails", playlistId=pl, maxResults=50, pageToken=token).execute()
        ids += [i["contentDetails"]["videoId"] for i in r.get("items", [])]
        token = r.get("nextPageToken")
        if not token:
            break
    out = []
    for i in range(0, len(ids), 50):
        r = yt.videos().list(part="snippet,status,statistics", id=",".join(ids[i:i + 50])).execute()
        for v in r.get("items", []):
            out.append({"id": v["id"], "title": v["snippet"]["title"], "privacy": v["status"]["privacyStatus"],
                        "scheduled": bool(v["status"].get("publishAt")),
                        "views": int(v.get("statistics", {}).get("viewCount", 0))})
    return out


def already_on_channel(ep: dict, uploads: list[dict]) -> list[dict]:
    """Copies of this episode that are live (public, unlisted or scheduled): same title or an id the queue recorded."""
    known = {ep.get("youtube_id"), ep.get("old_youtube_id"), ep.get("video_id")} - {None}
    same = [u for u in uploads if u["id"] in known or _norm(u["title"]) == _norm(ep["title"])]
    # a plain private video with no schedule is already taken down; a scheduled one is private *with* publishAt
    return [u for u in same if u["privacy"] != "private" or u.get("scheduled")]


def take_down(yt, vid: str) -> None:
    """Make a video plain private (reversible: it can be made public again from YouTube Studio)."""
    st = yt.videos().list(part="status", id=vid).execute()["items"][0]["status"]
    yt.videos().update(part="status", body={"id": vid, "status": {
        "privacyStatus": "private", "selfDeclaredMadeForKids": st.get("selfDeclaredMadeForKids", False)}}).execute()


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
        # optional cadence: {"every_days": 2, "anchor": "2026-11-13"} → only on days anchor + k*every_days
        every = int(slot.get("every_days", 1) or 1)
        if every > 1:
            anchor = date.fromisoformat(slot.get("anchor", "2026-01-01"))
            if (t.date() - anchor).days % every:
                print(f"Slot {slot.get('series')} {slot['time']} skipped on {t.date()} (every {every} days).")
                continue
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
    accounts = settings.get("accounts") or {}
    clients: dict[str, object] = {}

    def yt_for(series):
        acc = accounts.get(series or "", "tech")
        if acc not in clients:
            clients[acc] = youtube_client(acc)
        return clients[acc]

    yt = None if DRY_RUN else yt_for(None)
    taken: set[str] = set()
    for series, when in slots:
      while True:  # a duplicate is skipped and the next ready episode of the series takes the slot
        ep = pick(data["episodes"], series, taken)
        if ep is None:
            print(f"::warning::No ready episode for series '{series}' — slot {when.isoformat()} stays empty.")
            break
        taken.add(ep["id"])
        yt_ep = None
        if not DRY_RUN:
            try:
                yt_ep = yt_for(ep.get("series"))
            except FileNotFoundError as err:
                print(f"::warning::{err}")
                break
        # Never upload an episode twice (owner's rule, 2026-11-10). A re-upload only happens when the episode is
        # marked "replace": true (a big improvement), and then the old copy is taken down, unless it already has
        # many views (settings.keep_if_views_at_least, default 1000): then the old one stays and the new is skipped.
        uploads = channel_uploads(yt_ep) if yt_ep is not None else []
        existing = already_on_channel(ep, uploads)
        if existing and not ep.get("replace"):
            print(f"::warning::{ep['id']} is already on the channel ({', '.join(u['id'] for u in existing)}); not uploading again.")
            ep.update(status="scheduled" if all(u["scheduled"] for u in existing) else "published",
                      youtube_id=existing[0]["id"])
            QUEUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            continue
        keep_at = int(settings.get("keep_if_views_at_least", 1000))
        if existing and max(u["views"] for u in existing) >= keep_at:
            best = max(existing, key=lambda u: u["views"])
            print(f"::warning::{ep['id']}: old copy {best['id']} has {best['views']} views (>= {keep_at}); keeping it, skipping the re-upload.")
            ep.pop("replace", None)
            ep.update(status="published", youtube_id=best["id"])
            QUEUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            continue
        path = OUT / f"{ep['id']}.mp4"
        print(f"Rendering {ep['composition']} → {path.name}")
        render(ep["composition"], path)
        if DRY_RUN:
            print(f"[dry run] would schedule {ep['id']} ({series}) for {when.isoformat()}")
            break
        vid = upload(yt_ep, path, ep, settings, when)
        for u in existing:
            take_down(yt_ep, u["id"])
            ep.setdefault("removed_youtube_ids", []).append(u["id"])
            print(f"Replaced: old copy {u['id']} ({u['views']} views) is now private.")
        ep.pop("replace", None)
        playlist = (settings.get("playlists") or {}).get(ep.get("series") or "")
        if playlist:
            add_to_playlist(yt_ep, playlist, vid)
        ep.update(status="scheduled", youtube_id=vid, publish_at=when.isoformat())
        print(f"Scheduled {ep['id']} as https://youtu.be/{vid} for {when.isoformat()}")
        QUEUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        break

    if yt is not None:
        write_stats(yt, data)
    for series in {s for s, _ in slots if s}:
        left = len([e for e in data["episodes"] if e.get("status") == "ready" and e.get("series") == series])
        if left < 3:
            print(f"::warning::Only {left} ready '{series}' episode(s) left in the queue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
