# Analytics (retention) — read-only

`scripts/analytics.py` writes `retention.json` (تك عالماشي) and `retention_horror.json` here every day
(`.github/workflows/analytics.yml`, 09:30 UTC). Per public video: retention curve, average view %,
average view duration, subscribers gained/lost, subscribers per 1,000 views, and the biggest drop.

It uses a **separate read-only token** (`youtube_analytics_<channel>.enc`, scope
`yt-analytics.readonly`). It cannot upload, edit, delete or reply. The publishing token
(`youtube_token*.enc`) is never touched.

> **Public:** this repository is public, so these JSON files are readable by anyone (like
> `docs/stats*.json`). They hold only per-video counts and ratios for our own channels: no viewer
> identities and no tokens.

## One-time setup (per channel) — الإعداد مرة وحدة لكل قناة
1. Google Cloud Console → the project that owns OAuth client `1098334853097-…` → APIs & Services →
   Library → **YouTube Analytics API** → Enable.
   (فعّل YouTube Analytics API بنفس مشروع Google Cloud.)
2. Run `python scripts/analytics_auth_url.py` and open the address it prints.
3. Pick the **channel** (the Brand Account, not the personal account) and allow.
   If Google shows "app not verified", choose Advanced → continue (it is our own app).
   (اختار القناة نفسها، مش الحساب الشخصي.)
4. The browser goes to a `localhost` page that does not load. Copy that whole address.
5. GitHub → Actions → **Connect YouTube (one time)** → Run workflow:
   paste the address, account = `tech` or `horror`, **purpose = `analytics`**.
   The workflow refuses the code if it grants anything other than read-only analytics.
6. Repeat for the other channel, then run **Analytics (retention)** once by hand.

Data lags 2–3 days, so the newest videos show zeros at first.

## Reading the curve
`curve` = `[time ratio 0–1, audienceWatchRatio, relativeRetentionPerformance]`.
`audienceWatchRatio` = segment watches ÷ video views; above 1 means re-watching. It is **not** a
swipe-away number. `first_segment_ratio` is the first point; `biggest_drop` is the largest fall
between two neighbouring points.

If the OAuth app is in "Testing" status in Google Cloud, refresh tokens expire after 7 days; the
publishing token has lasted longer, so the app is expected to be in production.
