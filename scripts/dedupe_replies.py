"""Delete duplicate replies the bot posted to the same person on the same video, keeping only the first one.

Owner's rule (2026-11-14): one person gets ONE reply per video, never more. On 2026-11-13/14 a bug made
auto_reply.py answer the same comment 156 times; this script cleans that up and keeps watching for it.

For each video in files/files_map.json with a videoId: read every comment thread and its replies, group the
replies written by our own channel (the token's channel, and the video owner) by the top-level comment's author,
keep the oldest reply of each group and delete the rest.

Quota: reads cost 1 unit per page; each delete costs 50, and the 10,000/day quota is shared with uploads.
So deletes are capped per run (MAX_DELETES, default 25) and per quota day (DAILY_DELETES, default 100,
counted in docs/dedupe_state.json), and none happen 08:00-10:00 UTC while today's uploads run.

Env: YT_REFRESH_TOKEN, YT_CLIENT_SECRET.  DRY_RUN=1 only lists what it would delete.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from auto_reply import client, MAP  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "docs" / "dedupe_state.json"
DRY_RUN = os.environ.get("DRY_RUN") == "1"
MAX_DELETES = int(os.environ.get("MAX_DELETES", "25"))
DAILY_DELETES = int(os.environ.get("DAILY_DELETES", "100"))


def quota_day(now: datetime) -> str:
    return (now - timedelta(hours=8)).strftime("%Y-%m-%d")  # quota resets 08:00 UTC


def pages(call, **kw):
    token = None
    while True:
        r = call(pageToken=token, **kw).execute() if token else call(**kw).execute()
        yield from r.get("items", [])
        token = r.get("nextPageToken")
        if not token:
            return


def main() -> int:
    try:
        return run()
    except Exception as err:
        if "quotaExceeded" in str(err) or "quota" in str(err).lower():
            print("::warning::YouTube quota used up; duplicates will be deleted after the 08:00 UTC reset.")
            return 0
        raise


def run() -> int:
    if not os.environ.get("YT_REFRESH_TOKEN"):
        print("YouTube token not available; nothing to do.")
        return 0
    now = datetime.now(timezone.utc)
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        state = {}
    if state.get("day") != quota_day(now):
        state = {"day": quota_day(now), "deleted": 0, "total": state.get("total", 0)}
    in_upload_window = 8 <= now.hour < 10
    budget = min(MAX_DELETES, max(0, DAILY_DELETES - state["deleted"]))

    yt = client()
    me = yt.channels().list(part="id", mine=True).execute()["items"][0]["id"]
    entries = [e for e in json.loads(MAP.read_text())["files"] if e.get("videoId")]
    extra = []  # (episode, who, comment id)
    for e in entries:
        try:
            threads = list(pages(yt.commentThreads().list, part="snippet", videoId=e["videoId"],
                                 maxResults=100, textFormat="plainText"))
        except Exception as err:
            print(f"[{e['episode']}] cannot read comments: {err}")
            continue
        ours = {}  # top-level author -> [(published, comment id)]
        for th in threads:
            s = th["snippet"]
            if s.get("totalReplyCount", 0) == 0:
                continue
            owner = s.get("channelId")
            who = s["topLevelComment"]["snippet"].get("authorChannelId", {}).get("value") \
                or s["topLevelComment"]["snippet"].get("authorDisplayName", "?")
            for r in pages(yt.comments().list, part="snippet", parentId=th["id"], maxResults=100,
                           textFormat="plainText"):
                author = r["snippet"].get("authorChannelId", {}).get("value")
                if author in (me, owner):
                    ours.setdefault(who, []).append((r["snippet"]["publishedAt"], r["id"]))
        for who, rows in ours.items():
            rows.sort()
            for _, cid in rows[1:]:
                extra.append((e["episode"], who, cid))
        dup = sum(len(v) - 1 for v in ours.values())
        print(f"[{e['episode']}] {len(threads)} threads, {sum(len(v) for v in ours.values())} of our replies, {dup} duplicates")

    print(f"Duplicates found: {len(extra)}")
    state["pending"] = len(extra)
    if extra and not DRY_RUN:
        if in_upload_window:
            print("08:00-10:00 UTC: leaving the quota to today's uploads; deleting later.")
            budget = 0
        done = 0
        for ep, who, cid in extra[:budget]:
            try:
                yt.comments().delete(id=cid).execute()
                done += 1
            except Exception as err:
                print(f"::warning::[{ep}] could not delete {cid}: {err}")
                break  # quota or permission problem: stop, try again next run
        state["deleted"] += done
        state["total"] = state.get("total", 0) + done
        state["pending"] = len(extra) - done
        print(f"Deleted {done}; {state['pending']} left (today {state['deleted']}/{DAILY_DELETES}).")
    elif DRY_RUN:
        for ep, who, cid in extra[:50]:
            print(f"WOULD delete [{ep}] reply {cid} (to {who})")
    state["checked"] = now.replace(microsecond=0).isoformat()
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(state, indent=1) + "\n", encoding="utf-8")
    if state["pending"]:
        print(f"::warning::{state['pending']} duplicate replies still to delete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
