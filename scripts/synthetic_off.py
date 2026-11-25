"""Set YouTube's "Altered or synthetic content" to NO on code-drawn videos only.

Owner's decision (2026-11-25): videos drawn in code (episodes.json entries with a "composition")
are animation, so "altered content" = No. Videos built from AI images (episodes with a "video"
file, e.g. دفتر الجارة) are NOT changed. Videos on the channel that episodes.json does not know are
NOT changed either; they are listed so the owner can decide.

Only status.containsSyntheticMedia changes. Every other status field the API returns as writable
(privacyStatus, publishAt, license, embeddable, publicStatsViewable, selfDeclaredMadeForKids) is sent
back unchanged, so schedules and visibility stay as they are.

Default is a dry run that changes nothing and prints the plan. APPLY=1 makes the changes.
Usage: python synthetic_off.py [tech|horror]
"""
import json
import os
import sys
from pathlib import Path

from publish import youtube_client

ROOT = Path(__file__).resolve().parent.parent
WRITABLE = ("privacyStatus", "publishAt", "license", "embeddable", "publicStatsViewable", "selfDeclaredMadeForKids")


def classify(episodes: list[dict]) -> tuple[set, set]:
    code, ai = set(), set()
    for e in episodes:
        ids = {e.get("youtube_id"), e.get("video_id")} - {None}
        (code if e.get("composition") and not e.get("video") else ai).update(ids)
    return code, ai


def new_status(st: dict) -> dict:
    body = {k: st[k] for k in WRITABLE if k in st}
    if body.get("privacyStatus") != "private":
        body.pop("publishAt", None)  # publishAt is only valid on scheduled private videos
    body["containsSyntheticMedia"] = False
    return body


def channel_videos(yt) -> list[dict]:
    ch = yt.channels().list(part="contentDetails", mine=True).execute()["items"][0]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, token = [], None
    while True:
        r = yt.playlistItems().list(part="contentDetails", playlistId=uploads, maxResults=50, pageToken=token).execute()
        ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        token = r.get("nextPageToken")
        if not token:
            break
    out = []
    for i in range(0, len(ids), 50):
        out += yt.videos().list(part="status,snippet", id=",".join(ids[i:i + 50])).execute()["items"]
    return out


def main(account: str = "tech") -> int:
    apply = os.environ.get("APPLY") == "1"
    q = json.loads((ROOT / "episodes.json").read_text(encoding="utf-8"))
    code, ai = classify(q["episodes"])
    yt = youtube_client(account)
    changed = kept_ai = unknown = already = 0
    for v in channel_videos(yt):
        vid, st, title = v["id"], v["status"], v["snippet"]["title"][:60]
        flag = st.get("containsSyntheticMedia")
        if vid in ai:
            kept_ai += 1
            print(f"KEEP (AI images)   {vid}  altered={flag}  {title}")
        elif vid not in code:
            unknown += 1
            print(f"SKIP (unknown)     {vid}  altered={flag}  {title}")
        elif flag is False:
            already += 1
            print(f"OK   (already No)  {vid}  {title}")
        else:
            changed += 1
            print(f"{'CHANGED' if apply else 'WOULD CHANGE'} -> No  {vid}  altered={flag}  {title}")
            if apply:
                yt.videos().update(part="status", body={"id": vid, "status": new_status(st)}).execute()
    mode = "APPLIED" if apply else "DRY RUN (nothing changed)"
    print(f"\n[{account}] {mode}: {changed} set to No, {already} already No, {kept_ai} AI-image kept, {unknown} unknown skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "tech"))
