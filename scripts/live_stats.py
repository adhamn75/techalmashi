"""Write docs/stats.json (current numbers) and docs/history.json (snapshots over time)
for the live page at https://adhamn75.github.io/techalmashi/live.html.

Runs in GitHub Actions every few minutes with the channel's own YouTube token.
Reads only: channel totals and each public video's views, likes and comments.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

from publish import youtube_client

DOCS = Path(__file__).resolve().parent.parent / "docs"
KEEP = 3000  # history points (~3 weeks at one per 10 minutes)


def main(account: str = "tech", suffix: str = "") -> None:
    yt = youtube_client(account)
    ch = yt.channels().list(part="statistics,snippet,contentDetails", mine=True).execute()["items"][0]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, token = [], None
    while True:
        r = yt.playlistItems().list(part="contentDetails", playlistId=uploads, maxResults=50, pageToken=token).execute()
        ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        token = r.get("nextPageToken")
        if not token:
            break
    videos = []
    for i in range(0, len(ids), 50):
        r = yt.videos().list(part="statistics,snippet,status", id=",".join(ids[i:i + 50])).execute()
        for v in r["items"]:
            if v["status"]["privacyStatus"] != "public":
                continue
            st = v.get("statistics", {})
            videos.append({"id": v["id"], "title": v["snippet"]["title"], "published": v["snippet"]["publishedAt"],
                           "views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                           "comments": int(st.get("commentCount", 0))})
    videos.sort(key=lambda v: v["published"], reverse=True)
    cs = ch["statistics"]
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    stats = {"updated": now, "channel": {"title": ch["snippet"]["title"],
             "subscribers": int(cs.get("subscriberCount", 0)), "views": int(cs.get("viewCount", 0)),
             "videos": int(cs.get("videoCount", 0))}, "videos": videos}
    DOCS.mkdir(exist_ok=True)
    (DOCS / f"stats{suffix}.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    hp = DOCS / f"history{suffix}.json"
    hist = json.loads(hp.read_text(encoding="utf-8")) if hp.exists() else []
    hist.append({"t": now, "subs": stats["channel"]["subscribers"], "views": sum(v["views"] for v in videos),
                 "likes": sum(v["likes"] for v in videos), "comments": sum(v["comments"] for v in videos)})
    hp.write_text(json.dumps(hist[-KEEP:], separators=(",", ":")) + "\n", encoding="utf-8")
    if account == "tech":
        q = json.loads((DOCS.parent / "episodes.json").read_text(encoding="utf-8"))
        keep = ("id", "series", "title", "status", "publish_at", "youtube_id", "video_id")
        (DOCS / "queue.json").write_text(json.dumps([{k: e.get(k) for k in keep} for e in q["episodes"]],
                                                    ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(videos)} public videos, {stats['channel']['subscribers']} subscribers")


if __name__ == "__main__":
    import sys
    acc = sys.argv[1] if len(sys.argv) > 1 else "tech"
    main(acc, "" if acc == "tech" else f"_{acc}")
