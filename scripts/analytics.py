"""Write analytics/retention.json (tech) or analytics/retention_<account>.json with per-video
audience data: retention curve, average view %, average view duration and subscribers gained/lost.

Uses the separate READ-ONLY analytics token (youtube_analytics_<account>.enc, scope
yt-analytics.readonly). It never reads the publishing token. The video list comes from the
existing docs/stats*.json written by live_stats.py, so no YouTube Data API quota is spent.

Note on the curve: audienceWatchRatio = segment watches / video views (Google's definition). It can
be above 1 when people re-watch, and it is not a Shorts "swipe-away" number.

Usage: python analytics.py [tech|horror]
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")  # YouTube Analytics reporting days are Pacific time

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = ROOT / "analytics"
CLIENT_ID = "1098334853097-svmse3o063e65tfumg0q23u3cml9mttt.apps.googleusercontent.com"
SUMMARY_METRICS = "views,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost"
CURVE_METRICS = "audienceWatchRatio,relativeRetentionPerformance"


def token_path(account: str) -> Path:
    return ROOT / f"youtube_analytics_{account}.enc"


def suffix(account: str) -> str:
    return "" if account == "tech" else f"_{account}"


def stats_path(account: str) -> Path:
    return DOCS / f"stats{suffix(account)}.json"


def out_path(account: str) -> Path:
    return OUT / f"retention{suffix(account)}.json"


def analytics_refresh_token(account: str) -> str:
    out = subprocess.run(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-a", "-A", "-pass", "env:YT_CLIENT_SECRET",
                          "-in", str(token_path(account))], capture_output=True, text=True, check=True)
    return out.stdout.strip()


def analytics_client(account: str):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=analytics_refresh_token(account),
        client_id=CLIENT_ID,
        client_secret=os.environ["YT_CLIENT_SECRET"].strip(),
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/yt-analytics.readonly"],
    )
    return build("youtubeAnalytics", "v2", credentials=creds, cache_discovery=False)


def rows_as_dicts(resp: dict) -> list[dict]:
    names = [h["name"] for h in resp.get("columnHeaders", [])]
    return [dict(zip(names, row)) for row in resp.get("rows") or []]


def parse_curve(resp: dict) -> list[list[float]]:
    pts = [[float(r["elapsedVideoTimeRatio"]), float(r["audienceWatchRatio"]),
            float(r["relativeRetentionPerformance"]) if r.get("relativeRetentionPerformance") is not None else None]
           for r in rows_as_dicts(resp)]
    return sorted(pts, key=lambda p: p[0])


TIE_EPS = 1e-9  # only absorbs float noise (1.0-0.8 vs 0.8-0.6); real differences are far larger


def biggest_drop(curve: list[list[float]]):
    """Largest decrease in watch ratio between adjacent points (ties -> earliest); None if none decreases."""
    best, best_raw = None, 0.0
    for a, b in zip(curve, curve[1:]):
        drop = a[1] - b[1]
        if drop > 0 and (best is None or drop > best_raw + TIE_EPS):
            best, best_raw = {"from_ratio": a[0], "to_ratio": b[0], "drop": round(drop, 6)}, drop
    return best


def pacific_date(ts: str | None, fallback: str) -> str:
    """YouTube Analytics days are US Pacific; convert a UTC publish timestamp to that calendar date."""
    if not ts:
        return fallback
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return dt.astimezone(PACIFIC).date().isoformat()


def error_text(e: Exception) -> str:
    """Short error with Google's reason (HttpError text starts with a long URL that hid it)."""
    resp = getattr(e, "resp", None)
    if resp is not None and hasattr(e, "content"):
        try:
            err = json.loads(e.content.decode("utf-8", "replace")).get("error", {})
            reasons = ",".join(d.get("reason", "") for d in err.get("errors", []) if isinstance(d, dict))
            return f"HTTP {getattr(resp, 'status', '?')} {reasons}: {str(err.get('message', ''))[:200]}"
        except (ValueError, AttributeError):
            pass
    return f"{type(e).__name__}: {str(e)[:200]}"


def per_1k(subs: int, views: int):
    return round(1000 * subs / views, 2) if views else None


def video_record(yt, video: dict, today: str) -> dict:
    rec = {"id": video["id"], "title": video.get("title"), "published": video.get("published"),
           "views": 0, "avg_view_duration_s": None, "avg_view_pct": None, "subs_gained": 0, "subs_lost": 0,
           "subs_per_1k_views": None, "curve": [], "first_segment_ratio": None, "biggest_drop": None, "error": None}
    try:
        start = min(pacific_date(video.get("published"), today), today)
        common = {"ids": "channel==MINE", "startDate": start, "endDate": today, "filters": f"video=={video['id']}"}
        summary = rows_as_dicts(yt.reports().query(metrics=SUMMARY_METRICS, **common).execute())
        if summary:
            s = summary[0]
            rec["views"] = int(s.get("views") or 0)
            rec["avg_view_duration_s"] = s.get("averageViewDuration")
            rec["avg_view_pct"] = s.get("averageViewPercentage")
            rec["subs_gained"] = int(s.get("subscribersGained") or 0)
            rec["subs_lost"] = int(s.get("subscribersLost") or 0)
        rec["subs_per_1k_views"] = per_1k(rec["subs_gained"], rec["views"])
        curve = parse_curve(yt.reports().query(metrics=CURVE_METRICS, dimensions="elapsedVideoTimeRatio", **common).execute())
        rec["curve"] = curve
        rec["first_segment_ratio"] = curve[0][1] if curve else None
        rec["biggest_drop"] = biggest_drop(curve)
    except Exception as e:  # one video must never stop the others
        rec["error"] = error_text(e)
    return rec


def build_report(yt, account: str, videos: list[dict], now: datetime) -> dict:
    today = now.astimezone(PACIFIC).date().isoformat()
    recs = [video_record(yt, v, today) for v in videos]
    views = sum(r["views"] for r in recs)
    subs = sum(r["subs_gained"] for r in recs)
    pcts = [r["avg_view_pct"] for r in recs if r["avg_view_pct"] is not None]
    return {"updated": now.replace(microsecond=0).isoformat(), "account": account, "videos": recs,
            "summary": {"videos": len(recs), "subs_gained": subs, "views": views,
                        "subs_per_1k_views": per_1k(subs, views),
                        "avg_view_pct_median": median(pcts) if pcts else None}}


def main(account: str = "tech", client_factory=analytics_client, now: datetime | None = None) -> int:
    if not token_path(account).exists():
        print(f"Analytics not connected for '{account}' ({token_path(account).name} missing): "
              "see analytics/README.md. Skipping.")
        return 0
    sp = stats_path(account)
    if not sp.exists():
        print(f"{sp.name} missing: run the Live stats workflow first. Skipping.")
        return 0
    videos = json.loads(sp.read_text(encoding="utf-8")).get("videos", [])
    report = build_report(client_factory(account), account, videos, now or datetime.now(timezone.utc))
    OUT.mkdir(exist_ok=True)
    out_path(account).write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    s = report["summary"]
    print(f"{s['videos']} videos, {s['subs_gained']} subs gained, {s['subs_per_1k_views']} subs per 1k views")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "tech"))
