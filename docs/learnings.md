# Learnings

## 2026-11-20 (scheduled production run)
- Official channel (10 public videos): family explainers about a direct threat to the child hold 1.2k–1.4k (voice-clone call 1,405, «account suspended» 1,229, scam message 1,235); the «send me the code» (320) and location (17) ones lag — a concrete scary moment in the title beats a settings tip.
- Excel: Snake 1,291 and Mandelbrot 1,328 both hit ~1.3k, so a striking visual hook can work even when it is not a game; Tetris 391, cube 253, 3D maze 62. Famous game + "free file" stays the safest bet; the maze's low count is the outlier, not the rule.
- Horror (code-drawn): titles shaped «Object emoji + an impossible detail… + twist» (own number 1,367, gallery 1,244, ceiling 1,137, closet 1,126, kitchen 1,047) beat the early «X | …» titles (mirror 18, frame481 93, elevator 141) by 10×. Keep that title shape.
- دفتر الجارة: eps 1–3 got 565–831, ep 4 only 83 — the old «دفتر الجارة 📓 الحلقة N:» title shape loses; the new per-story titles (2026-11-19 rule) should be compared once they land.
- Ops: two manual publish runs on 11-19 both scheduled Excel for 11-20 13:00 (ep06 + ep07 at the same minute). publish.py now leaves a slot empty when that series already has a video scheduled that day.

## 2026-11-20 (competitor watch, first run)
- Public YouTube pages are not readable from the sandbox; only vidIQ stats pages work. Found 3 horror channels with real numbers; no Arabic Excel/family channel had readable stats → fill via yt-dlp in Actions.
- Big Arabic horror channels (593K, 1.12M subs) get their spikes (25–87×) from one trending object (Labubu) + a part 2; their normal videos are 1–8K. Our ~1k consistency is comparable; we lack a trend-riding episode.
- Gap is subscriber conversion (~6 subs per ~5k views), not views. Test: one trend episode per series, part-2 titles, spoken subscribe line.

## 2026-11-21 (scheduled production run)
- Excel game episodes keep paying off: Pac-Man reached ~760 views within a day of going up (11-20) while Flappy sits at ~130 on the same day — the chase/AI angle hooks harder than "you can play it"; show the trick (BFS ghosts, flood-fill, merge rule) on screen, not just gameplay.
- Mandelbrot (1,330) proves one striking visual beats a dull game; for games the first second must already be in motion (ep10 opens a flood-fill ripple at frame 10, ep11 slides tiles at frame 14).
- Excel queue was the bottleneck (1 ready vs target 3) while Family had 10 ready: production effort should go to Excel until it holds 3, Family needs nothing for ~10 days.
- TTS at +20% ran 18–20 s for 5 lines; captions that read a number aloud («ألفين وثمانية وأربعين») cost ~1.5 s — keep scripts to 4–5 short lines and show the number as digits in the caption.

## 2026-11-22 (scheduled production run)
- All queues at target: Excel 3 ready (Breakout, Minesweeper, 2048), Family 9, code-drawn horror 2 (letter, stairs). No new episode needed; next Excel to build is still the ep12 platformer promised by ep11.
- Family school-uniform stickman (fam14) hit 728 views in its first day vs 9 for the re-uploaded gems video the same slot a day earlier — new, concrete "photo reveals X" hooks beat re-uploads by far.
- Space Invaders sits at ~170 after a day vs Pac-Man ~1.1k: a shooter alone is weaker than a game with a visible "brain" (BFS ghosts). For Breakout/Minesweeper/2048 lead the caption with the trick (bounce physics, flood-fill, merge rule), not "you can play it".
- Family has ~9 days of stock at one per day; production time is better spent on the Excel platformer (ep12) so it is ready before 2048 airs (~11-27).

## 2026-11-22 (competitor watch, 2nd run)
- Still no readable Arabic Excel/family channels; read two adjacent ones: Aboud Shorts (1.05M subs, hits 5–16M = «هل فعلاً X؟/لن تصدق» physical-claim clips) and Miao Arabic Shorts (1.14M, recurring character + situation titles). Both decayed hard when topic variety/cadence dropped.
- Our hits (~1.0–1.4K) are 10×+ below theirs, and our subs/1k views is ~1. Ceiling is set by how broad the "is it real?" claim is.
- Tests for next week: «هل فعلاً…؟» title form on Excel + family; Layla named in title as recurring character; spoken subscribe line. Details: docs/competitors_report.md.
- A/B title test (started 2026-11-22, owner OK'd): «هل فعلاً…؟» titles on ep09-breakout, ep10-minesweeper, fam09-qr; controls with the old shape: ep11-2048, fam07/08. Compare views after ~3 days; keep the winner shape.

## 2026-11-23 (scheduled production run)
- Excel dropped to 2 ready (Breakout went out); built ep12 platformer (Ep12Runner + files/platformer.xlsm). Family 8 ready, code-drawn horror 2 ready: no work needed there.
- Family keeps landing ~1.05k per video (passphrase 1,058 and school-uniform 1,062 in a day) while Space Invaders sits at 175 and Flappy at ~950: concrete "danger to your child" hooks are the channel's floor, Excel games swing with how famous + how visible the trick is.
- 5 TTS lines at +20% came to 18.2 s of voice; dropping one line kept ep12 at 16.5 s. Budget 4 lines (≈ 15 s of voice) for Excel episodes and show the rest on screen.
- Platformer tuning: with gravity 0.22 a jump of -1.5 could not reach a platform 5 cells up and made the hero bonk on it; -1.8 gives a 6.5-cell jump. Simulate the level (same rules in a .sim.ts) before filming, so the autopilot never dies on camera and the file is beatable.

## 2026-11-23 (owner review session)
- Channel totals: 8 subs / ~11.9k views; subs per 1k views ≈ 1. Official channel floor ≈ 1k views; family stickman episodes (fam14 1,074, fam15 1,060) match the best older hits, so the stickman look stays.
- Added docs/master_prompt.md (shared planning skeleton + per-series look blocks, no look change) and the spoken-subscribe-phrase rule in CLAUDE.md for new episodes only.
- Retention analysis blocked: token has no analytics scope. Plan: owner sends Studio retention screenshots (3 top, 3 bottom) → yt-retention.
