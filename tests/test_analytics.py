import json
import sys
import tempfile
import unittest
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import analytics  # noqa: E402
import analytics_auth_url  # noqa: E402
import exchange_analytics_code as xc  # noqa: E402

A = "https://www.googleapis.com/auth/yt-analytics.readonly"


class FakeQuery:
    def __init__(self, resp, fail=False):
        self.resp, self.fail = resp, fail

    def execute(self):
        if self.fail:
            raise RuntimeError("boom")
        return self.resp


class FakeYT:
    def __init__(self, fail_ids=()):
        self.fail_ids = fail_ids

    def reports(self):
        return self

    def query(self, metrics, dimensions=None, filters="", **_):
        vid = filters.split("==")[1]
        if vid in self.fail_ids:
            return FakeQuery(None, fail=True)
        if dimensions:
            return FakeQuery({"columnHeaders": [{"name": "elapsedVideoTimeRatio"}, {"name": "audienceWatchRatio"},
                                                {"name": "relativeRetentionPerformance"}],
                              "rows": [[0.5, 0.6, 0.4], [0.0, 1.2, 0.5], [1.0, 0.3, 0.2]]})
        return FakeQuery({"columnHeaders": [{"name": n} for n in analytics.SUMMARY_METRICS.split(",")],
                          "rows": [[2000, 12.5, 80.0, 3, 1]]})


class CurveTests(unittest.TestCase):
    def test_early_drop_and_ratio_above_one(self):
        c = [[0.0, 1.2, None], [0.1, 0.5, None], [0.2, 0.45, None]]
        self.assertEqual(analytics.biggest_drop(c), {"from_ratio": 0.0, "to_ratio": 0.1, "drop": 0.7})

    def test_no_decrease_and_single_point(self):
        self.assertIsNone(analytics.biggest_drop([[0, 0.5, None], [1, 0.6, None]]))
        self.assertIsNone(analytics.biggest_drop([[0, 0.5, None]]))
        self.assertIsNone(analytics.biggest_drop([]))

    def test_tiny_and_close_drops(self):
        self.assertIsNotNone(analytics.biggest_drop([[0, 1.0, None], [1, 0.99996, None]]))
        c = [[0, 1.0, None], [0.1, 0.69999, None], [0.2, 0.39992, None]]  # 0.30001 then 0.30007
        self.assertEqual(analytics.biggest_drop(c)["from_ratio"], 0.1)

    def test_pacific_dates(self):
        self.assertEqual(analytics.pacific_date("2026-11-20T02:00:00Z", "x"), "2026-11-19")  # winter, UTC-8
        self.assertEqual(analytics.pacific_date("2026-07-01T06:30:00Z", "x"), "2026-06-30")  # summer, UTC-7
        self.assertEqual(analytics.pacific_date("2026-07-01T08:00:00Z", "x"), "2026-07-01")
        self.assertEqual(analytics.pacific_date(None, "fallback"), "fallback")

    def test_tie_takes_earliest(self):
        c = [[0, 1.0, None], [0.1, 0.8, None], [0.2, 0.6, None]]
        self.assertEqual(analytics.biggest_drop(c)["from_ratio"], 0)


class ReportTests(unittest.TestCase):
    def test_record_maths_and_error_isolation(self):
        vids = [{"id": "a", "title": "A", "published": "2026-11-20T10:00:00Z"}, {"id": "b", "title": "B"}]
        r = analytics.build_report(FakeYT(fail_ids=("b",)), "tech", vids, datetime(2026, 11, 24, tzinfo=timezone.utc))
        a, b = r["videos"]
        self.assertEqual((a["views"], a["subs_gained"], a["subs_per_1k_views"]), (2000, 3, 1.5))
        self.assertEqual(a["curve"][0][0], 0.0)
        self.assertEqual(a["first_segment_ratio"], 1.2)
        self.assertEqual(a["biggest_drop"]["from_ratio"], 0.0)
        self.assertIsNone(a["error"])
        self.assertIn("boom", b["error"])
        self.assertEqual(r["summary"]["subs_per_1k_views"], 1.5)
        self.assertIsNone(analytics.per_1k(5, 0))

    def test_file_naming(self):
        self.assertEqual(analytics.out_path("tech").name, "retention.json")
        self.assertEqual(analytics.out_path("horror").name, "retention_horror.json")
        self.assertEqual(analytics.token_path("horror").name, "youtube_analytics_horror.enc")

    def test_missing_token_skips_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            with mock.patch.object(analytics, "ROOT", Path(d)), mock.patch.object(analytics, "OUT", Path(d) / "analytics"):
                factory = mock.Mock()
                self.assertEqual(analytics.main("tech", client_factory=factory), 0)
                factory.assert_not_called()
                self.assertFalse((Path(d) / "analytics").exists())


ROOT = Path(__file__).resolve().parent.parent


@unittest.skipUnless(__import__("shutil").which("bash"), "bash not available")
class WorkflowShellTests(unittest.TestCase):
    def run_bash(self, script: str, cwd: str) -> str:
        import subprocess
        return subprocess.run(["bash", "-c", script], cwd=cwd, capture_output=True, text=True, check=True).stdout

    def test_auth_routes_publish_and_analytics(self):
        import re
        text = (ROOT / ".github/workflows/auth.yml").read_text(encoding="utf-8")
        block = text.split("run: |", 1)[1].split("python3 scripts/exchange_code.py", 1)[0] + "python3 scripts/exchange_code.py\n          fi"
        block = "\n".join(l.strip() for l in block.splitlines())
        cases = {("publish", "tech"): ("exchange_code.py", "youtube_token.enc"),
                 ("publish", "horror"): ("exchange_code.py", "youtube_token_horror.enc"),
                 ("analytics", "tech"): ("exchange_analytics_code.py", "youtube_analytics_tech.enc"),
                 ("analytics", "horror"): ("exchange_analytics_code.py", "youtube_analytics_horror.enc")}
        for (purpose, acc), (script, f) in cases.items():
            body = re.sub(r"\$\{\{ inputs\.purpose \}\}", purpose, block)
            body = re.sub(r"\$\{\{ inputs\.account \}\}", acc, body)
            out = self.run_bash('python3() { echo "ran $1"; }\n' + body + '\necho "F=$F"', str(ROOT))
            with self.subTest(purpose=purpose, account=acc):
                self.assertIn(f"ran scripts/{script}", out)
                self.assertIn(f"F={f}", out)

    def test_save_guard_with_no_reports(self):
        text = (ROOT / ".github/workflows/analytics.yml").read_text(encoding="utf-8")
        guard = next(l.strip() for l in text.splitlines() if "no analytics reports yet" in l)
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "analytics").mkdir()
            out = self.run_bash(guard + "\necho SHOULD-NOT-REACH", d)
        self.assertIn("no analytics reports yet", out)
        self.assertNotIn("SHOULD-NOT-REACH", out)


class ScopeTests(unittest.TestCase):
    def test_auth_url_only_analytics_scope(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(analytics_auth_url.auth_url()).query)
        self.assertEqual(q["scope"], [A])
        self.assertNotIn("include_granted_scopes", q)
        self.assertEqual(q["access_type"], ["offline"])

    def test_exact_scope_accepted(self):
        self.assertEqual(xc.check_response({"scope": A, "refresh_token": "t"}), "t")

    def test_rejections(self):
        bad = [{"refresh_token": "t"},
               {"scope": "https://www.googleapis.com/auth/youtube", "refresh_token": "t"},
               {"scope": A + " https://www.googleapis.com/auth/youtube.force-ssl", "refresh_token": "t"},
               {"scope": A}]
        for resp in bad:
            with self.subTest(resp=resp), self.assertRaises(ValueError):
                xc.check_response(resp)

    def test_main_writes_nothing_on_bad_scope(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict("os.environ", {"YT_CLIENT_SECRET": "s", "AUTH_CODE": "c"}):
            cwd = Path.cwd()
            import os
            os.chdir(d)
            try:
                with mock.patch.object(xc, "exchange", return_value={"scope": "https://www.googleapis.com/auth/youtube", "refresh_token": "t"}):
                    self.assertEqual(xc.main(), 1)
                self.assertFalse(Path("token.txt").exists())
            finally:
                os.chdir(cwd)


if __name__ == "__main__":
    unittest.main()
