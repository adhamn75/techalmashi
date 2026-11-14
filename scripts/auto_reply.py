"""Reply to file requests in the comments, automatically, from GitHub Actions.

Every few minutes: for each Excel video in files/files_map.json that has a videoId, read its newest
comment threads (YouTube Data API, 1 quota unit per video) and, when a top-level comment asks for
the file (اريد / بدي / الملف / رابط / send / file ...), reply under it with that entry's "reply" text.
A thread is skipped when the channel already replied in it, so nobody gets two replies.
Every answered thread id is also kept in docs/replied.json (and every (video, author) in docs/requests.json),
so a comment is answered once even when the token's channel is not the video's owner (2026-11-14: one
comment got 156 replies because the owner check never saw the bot's own replies).
Kill switch: create the file .replies_off in the repo root and no reply is posted.

Env: YT_REFRESH_TOKEN, YT_CLIENT_SECRET.  DRY_RUN=1 lists what it would reply to without posting.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / "files" / "files_map.json"
DRY_RUN = os.environ.get("DRY_RUN") == "1"
BLOCK = ROOT / ".reply_blocked"  # untracked marker, lives for one watcher job
BLOCK_HOURS = 6
MAX_REPLIES = 30  # per run, safety cap (each reply costs 50 of 10,000 daily quota units)

ASK = re.compile(
    r"(أ|ا|إ)ريد|اريده|بد(ي|ى)|ابغ(ى|ا)|أبغ(ى|ا)|\bأبي\b|\bابي\b|ارسل|أرسل|ابعت|ابعث|الملف|ملف|رابط|لينك|"
    r"\bi\s*want\b|\bsend\b|\bfile\b|\blink\b|\bplease\b.*\b(file|link)\b",
    re.IGNORECASE,
)


def norm(s: str) -> str:
    return re.sub(r"[ً-ْـ]", "", s or "")  # drop harakat / tatweel


def is_request(text: str) -> bool:
    t = norm(re.sub(r"<[^>]+>", " ", text))
    return bool(ASK.search(t)) and len(t) < 300


def client():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id="1098334853097-svmse3o063e65tfumg0q23u3cml9mttt.apps.googleusercontent.com",
        client_secret=os.environ["YT_CLIENT_SECRET"].strip(),
        token_uri="https://oauth2.googleapis.com/token",
    )
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def owner_replied(yt, thread, owner: str) -> bool:
    s = thread["snippet"]
    if s["topLevelComment"]["snippet"].get("authorChannelId", {}).get("value") == owner:
        return True
    replies = thread.get("replies", {}).get("comments", [])
    if s.get("totalReplyCount", 0) > len(replies):  # API returns only some replies inline
        replies = yt.comments().list(part="snippet", parentId=thread["id"], maxResults=100).execute()["items"]
    return any(r["snippet"].get("authorChannelId", {}).get("value") == owner for r in replies)


LOG = Path(__file__).resolve().parent.parent / "docs" / "requests.json"
REPLIED = ROOT / "docs" / "replied.json"
OFF = ROOT / ".replies_off"


def load_replied() -> set:
    try:
        return set(json.loads(REPLIED.read_text(encoding="utf-8")))
    except Exception:
        return set()


def save_replied(ids: set) -> None:
    REPLIED.parent.mkdir(exist_ok=True)
    REPLIED.write_text(json.dumps(sorted(ids), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")


def logged_pairs() -> set:
    try:
        return {(r.get("videoId"), r.get("who")) for r in json.loads(LOG.read_text(encoding="utf-8"))}
    except Exception:
        return set()


def log_request(e: dict, who: str, text: str) -> None:
    from datetime import datetime, timezone
    rows = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else []
    rows.append({"t": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "episode": e["episode"],
                 "videoId": e["videoId"], "file": e.get("file", ""), "who": who, "text": text[:80]})
    LOG.parent.mkdir(exist_ok=True)
    LOG.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main() -> int:
    if not os.environ.get("YT_REFRESH_TOKEN"):
        print("YouTube token not available; nothing to do.")
        return 0
    if OFF.exists():
        print(f"Replies are switched off ({OFF.name} exists).")
        return 0
    entries = [e for e in json.loads(MAP.read_text())["files"] if e.get("videoId") and e.get("reply")]
    yt = client()
    sent = 0
    replied = load_replied()
    pairs = logged_pairs()
    try:
        me = yt.channels().list(part="id", mine=True).execute()["items"][0]["id"]
    except Exception:
        me = None
    for e in entries:
        try:
            resp = yt.commentThreads().list(
                part="snippet,replies", videoId=e["videoId"], order="time", maxResults=50, textFormat="plainText"
            ).execute()
        except Exception as err:  # comments disabled, video removed...
            print(f"[{e['episode']}] cannot read comments: {err}")
            continue
        for th in resp.get("items", []):
            top = th["snippet"]["topLevelComment"]["snippet"]
            owner = th["snippet"]["channelId"]
            who = top.get("authorDisplayName", "?")
            if th["id"] in replied or (e["videoId"], who) in pairs:
                continue
            if not is_request(top.get("textDisplay", "")):
                continue
            if owner_replied(yt, th, owner) or (me and me != owner and owner_replied(yt, th, me)):
                replied.add(th["id"])
                save_replied(replied)
                continue
            if sent >= MAX_REPLIES:
                print("Reached the per-run cap; the rest will be answered next run.")
                return 0
            if DRY_RUN:
                print(f"[{e['episode']}] WOULD reply to {who}: {top.get('textDisplay','')[:60]!r}")
            else:
                if BLOCK.exists() and time.time() - BLOCK.stat().st_mtime < BLOCK_HOURS * 3600:
                    print(f"[{e['episode']}] pending request from {who}; replies paused after a refused reply (see {BLOCK.name}).")
                    return 0
                try:
                    yt.comments().insert(
                        part="snippet", body={"snippet": {"parentId": th["id"], "textOriginal": e["reply"]}}
                    ).execute()
                except Exception as err:
                    # Each refused insert still costs 50 quota units; retrying every few minutes used up the
                    # whole daily quota (2026-11-12) and blocked uploads. Pause replies for BLOCK_HOURS.
                    BLOCK.write_text(str(err)[:500], encoding="utf-8")
                    print(f"::warning::reply refused, pausing replies for {BLOCK_HOURS} h: {err}")
                    return 0
                replied.add(th["id"])
                pairs.add((e["videoId"], who))
                save_replied(replied)
                print(f"[{e['episode']}] replied to {who}: {top.get('textDisplay','')[:60]!r}")
                log_request(e, who, top.get("textDisplay", ""))
            sent += 1
    print(f"Done: {sent} {'would-be ' if DRY_RUN else ''}replies across {len(entries)} videos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
