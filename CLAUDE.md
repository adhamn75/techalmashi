# تك عالماشي — how to make a new episode

Two series on one channel: **أسرار Excel** (`series: excel`) and **احمِ أطفالك على الإنترنت** (`series: family`, aimed at PARENTS, never marked made-for-kids).

This repo is a YouTube Shorts channel built entirely in code. GitHub Actions renders and
schedules whatever is `"ready"` in `episodes.json` every morning. Your job, when asked to
make episodes, is to keep that queue full with good, *different* episodes.

## The series
- Name: **أسرار Excel**. Audience: all Arabic speakers (Gulf pays best). Language: **Modern Standard Arabic (فصحى)** for captions and voice.
- Every episode shows something people don't believe Excel can do, then reveals how (VBA, formulas,
  Power Query, LAMBDA, Python in Excel…). It must be **real**: if the episode claims Excel does it,
  it has to be doable.
- Host: **ShieldBuddy** (`src/shared/ShieldBuddy.tsx`, the owner picked design 1: legs + sneakers), used through
  `Mokaab` in `src/shared/Mascot.tsx`. Props: `mood` (happy/shock/smirk), `wave`, `talk`, `wink`, `lookX`, `scale`, `y`, `rings`.
  Drive `talk` with `speaking(LINES, absoluteFrame)` from `src/shared/Voice.tsx` so the mouth follows the voice.
  The old img2threejs shield (`ShieldHost`) and Abu Khalye stay in the repo but are not used.
- Brand sign-off: «تك عالماشي · خلّيك ذكي!» (brand line, kept as is).

## Voice (narration)
- Voice: **ar-SA-HamedNeural** (free Microsoft Edge TTS), rate +15%, MSA. The cloud sandbox cannot reach the TTS host,
  so voices are made by GitHub: add the episode's lines to `voice/lines.json` and push; the `Voice-over (TTS)` workflow
  commits `voice/<episode>/<n>.mp3`. Pull, then trim silence and copy to `public/voice/<episode>/<n>.wav`:
  `ffmpeg -i n.mp3 -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" n.wav`
- Measure each wav and place lines with `VoiceTrack` so they never overlap; stretch scenes to fit the voice
  (episodes may run 15–18 s). Keep SFX at 0.4–0.6 volume under the voice.
- After rendering, normalise: `ffmpeg -i in.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out.mp4`.

## Hard rules
- 12–18 seconds. 30 fps, 1080×1920.
- The hook is the impossible thing itself, on screen from frame 0. No intro.
- Everything drawn in code: no AI images, no stock footage. Narration is the Hamed TTS voice above.
- Each episode must look different from the last one (layout, colors of the scene, motion,
  structure). Never copy an episode and swap the words — YouTube demonetises templated content.
- MSA captions, short, big (Cairo 900). SFX only from `public/sfx` via `<Sfx>`.
- End with a CTA that fits (file in comments, follow for part 2, "جرّبها").
- **Always end with a teaser for the next episode** (owner's rule, 2026-11-12), in both series: «الحلقة القادمة…» / «الجزء الثاني غدًا…»
  plus one line that makes the viewer want to come back (what the next game/scam will be, without spoiling it). Only tease an episode
  that is really planned in the queue. Say it in the voice and show it in the last caption.
  Only promise a file if one actually exists in `files/`.

## Adding an episode
1. `src/episodes/EpNNName.tsx` exporting the component and `EPNN_FRAMES`.
2. Register it in `src/Root.tsx`.
3. Render 3–4 stills at the busiest moments and look at them before anything else:
   `npx remotion still src/index.ts EpNNName out/check.png --frame=60 --gl=swangle`
4. Append to `episodes.json` with `"status": "ready"`, an Arabic title (≤ 100 chars, ends with #shorts),
   description, tags.
5. Commit and push.

## Episode ideas not yet made
Excel draws your photo (pixel art from cells) · full attendance system with overtime in one click ·
Excel sends WhatsApp messages · 3D cube spinning with formulas only · invoice that fills itself and
exports PDF · AI inside a cell · live gold/dollar prices refreshing · Excel plays music ·
Tetris in Excel · Excel as a calendar app · QR code generator in Excel.
Space Invaders made (ep 8, files/invaders.xlsm). Breakout made (ep 9, files/breakout.xlsm). Minesweeper made (ep 10, files/minesweeper.xlsm). 2048 made (ep 11, files/game2048.xlsm, OnKey arrows). Platformer made (ep 12, files/platformer.xlsm, original hero «Kubi», gravity line vy = vy + G). **Promised next Excel episode (ep 12 teaser «سيارةٌ تسابق الزحام»): a top-down car racing / traffic-dodge game in cells (VBA, lanes scroll down, arrows to steer, speed rises) — make it next (ep13). No real car brands or logos.**
Horror code-drawn eps made: rules, frame481, elevator, camera, mirror, own number, closet, gallery (h08), ceiling (h09), radio (h10), window (h11), footprints (h12), street lamp (h13, peephole), kitchen (h14, mother's voice), last bus (h15, one-point aisle + window reflection), baby monitor (h16, device on nightstand + LEDs), letter (h17, floor-level door gap + phone-torch reading), stairs (h18, side cut-away + step counter, 13th step opens its eyes).
**Promised next horror (h18 teaser «هاتفٌ مقطوعُ السلك… يرنّ»): a landline whose cord is cut, ringing — make it next.**

Family series (parents) — made: scam message, location, code, suspended, voice, gems, purchase, game-chat stranger (ep 8), QR scam (ep 9), failed-strategies-of-hacker (fam10, pre-rendered video), public Wi-Fi (fam11), passphrase (fam12), screen time (fam13), school-uniform photo (fam14, stickman look).
**Promised next (fam14 teaser «التحقق بخطوتين… في عشر ثوانٍ»): 2-step verification in 10 s — make it next (fam15), look different from fam10 hacker.** Still open: weak password vs passphrase ·
2-step verification in 10 s · fake Free-Fire/Roblox gem generator · screen-time setup on the phone ·
QR code scam · "send me the code you got" · public Wi-Fi · oversharing school uniform in photos ·
deepfake voice of a relative asking for money.

## Excel files for every Excel episode
Every Excel episode ships with its real file in `files/` (built by a script in `scripts/files/`, e.g. `make_cube3d.py`,
or VBA via pyOpenVBA like `snake.xlsm`), so commenters who ask can get it. Add an entry to `files/files_map.json`
(episode, title, file, reply text with the raw GitHub link; `videoId` once the video is on the channel). The `Auto-reply to file requests`
workflow (`scripts/auto_reply.py`, every 5 min, YouTube API, no vidIQ credits) reads that map and replies by itself to
comments like «اريده» — an entry needs its `videoId` to be answered. Because the file exists, the Excel CTA may say the file is in the comments.

## One reply per person (owner's rule, 2026-11-14) — never break this
The bot once replied 156 times to one comment (the owner check missed its own replies). Now: a person gets ONE reply
per video, ever. auto_reply.py remembers answered threads (docs/replied.json) and (video, author) pairs
(docs/requests.json); scripts/dedupe_replies.py (dedupe_replies.yml + hourly in the watcher) deletes any extra reply
we posted to the same person, keeping the first, within a quota cap (100 deletes/day, none 08–10 UTC).
Any change to replying must keep both guards. Kill switch: a file `.replies_off` in the repo root.

## Channels recovered — hold LIFTED (2026-11-19)
Owner's decision 2026-11-19: excel and family publish again (daily Excel 13:00, Family Tue+Fri 20:00, Horror daily 22:00).
Official channel = **@tech3almashi (UC089ZB6HkdbJhATBrddL7oQ)**, a Brand Account «almashi temp». The wrong channel @tech3almashi-n (UCAo35INP2CMim87ZrqF3jJw) was DELETED by the owner on 2026-11-19.
One Google login (tech3almashi@gmail.com) owns: tech3almashi (Brand «almashi temp») and Horror shorts (@Horrorshorts-l9i, a Brand Account).
Token: youtube_token.enc points at the ORIGINAL channel (at the Google chooser: tech3almashi@gmail.com, then Brand «almashi temp»; the plain account gives the wrong channel).
Playlists: Excel `PLYdOHth1Xago`, Family `PLfUdrVKeKj4Y` (settings.playlists).
**NEVER delete a channel, "Remove YouTube content", or a Brand Account again.** On 2026-11-19 «Remove YouTube content» on the plain account also deleted the Horror Brand Account (restored the same day from Google Account → Brand Accounts → Deleted accounts). «almashi hold» stays deleted.
Re-uploaded from -n: ep06-flappy, fam06-gems, fam07-purchase, ep07-pacman (one per series per day by the slot rule). Learnings accumulate in `docs/learnings.md`.

## Paid Excel packs — DORMANT (owner's decision, 2026-11-19)
Prepared in `monetization/` (plan, reply texts, listing copy, checklist). Files stay FREE; nothing in it is read by any
script or shown on the channel. Do NOT activate until the owner says «فعّلها» (gate: ~500 subs or steady requests + stable views).

## Publishing mode (current)
Fully automatic on GitHub, free, no vidIQ, no browser. youtube_token.enc (encrypted with YT_CLIENT_SECRET) holds a
permanent token with youtube + youtube.force-ssl, granted 2026-11-09 with the OAuth app In production.
- publish.yml uploads one "ready" episode per series each morning and schedules 13:00 / 20:00 Beirut.
- auto_reply.yml answers file requests under each video in files/files_map.json with its link.
- live_stats.yml refreshes docs/stats.json + history.json for https://adhamn75.github.io/techalmashi/live.html
Never mark an episode "ready" if it is already on the channel (check docs/stats.json), or it is uploaded twice.
- No double uploads (owner's rule, 2026-11-10). publish.py checks the channel's uploads (same title or a recorded
  youtube_id) before rendering and skips an episode that is already live or scheduled, moving on to the next ready one.
  Re-upload only for a big improvement: set `"replace": true` on the episode. Then the new copy goes up and the old one
  is made private, unless the old one already has ≥ `settings.keep_if_views_at_least` views (1000): then the old one
  stays, whatever it is, and the new one is not uploaded. To remove a stray copy by hand: Actions → "Cancel a scheduled
  video" (unschedule.yml, makes it private).

## Adopted third-party skills (`.claude/skills/`, MIT or Remotion licence — see `third_party/LICENSES.txt`)
Copied unmodified from their repos, so read these notes where our repo differs from theirs.

| Skill | From | Use it for |
|---|---|---|
| `motion-design` | whaleyxbt/claude-motion | Timing/easing/spring numbers and anti-patterns for every new episode. |
| `review-loop` | whaleyxbt/claude-motion | Contact sheets at every beat before a full render. |
| `sound-design` | whaleyxbt/claude-motion | The procedural `sfx/` engine (pure Python stdlib). |
| `remotion-motion-graphics` | haidrrrry/claude-remotion-skill | Remotion patterns: staggered entrances, gradient backgrounds, verified renders. |
| `yt-script`, `yt-package`, `yt-seo` | Jakeschincariol/youtube-agent-skill | Hook scoring (21 formulas), Arabic titles/descriptions, tags. |
| `yt-viral`, `yt-plan` | same | Rank what is working in the niche; plan the next batch. Needs public channel listings (yt-dlp), which run in GitHub Actions, not in the cloud sandbox. |
| `yt-comment`, `yt-audit`, `yt-retention` | same | Once the channel has comments/analytics exports to feed them. |
| `remotion-markup`, `remotion-render`, `remotion-multimedia`, `remotion-captions` | remotion-dev/skills (official) | Remotion's own best practices. Read `remotion-markup/arabic-text.md` before animating Arabic captions word by word (keeps letters joined, `dir="rtl"`). |

Differences from the source repos:
- claude-motion assumes `timeline.json` + `src/lib.ts`. Here, older episodes keep beats inline. For NEW
  episodes, put beats in `src/episodes/<id>.timeline.json` and pass it to the cue sheet (`sfx/cues/<id>.py`)
  so picture and sound share one clock.
- One-shot SFX used by `<Sfx>` are built by `python3 scripts/make_sfx.py` (C major). A full per-episode
  score can be rendered with `python3 -m sfx sfx/cues/<id>.py` and placed as one `<Audio>`.
- claude-motion's typography (Instrument Serif/Inter) does not apply: captions are Arabic, Cairo 900.
- The yt-* skills never publish; `scripts/publish.py` does, after review.

Not adopted (checked, not a fit): howseen-ai/claude-motion-design (HTML+Playwright pipeline, we already
use Remotion), AgriciDaniel/claude-youtube (overlaps yt-*, parts need YouTube/Gemini keys),
mohitagw15856/pm-claude-skills youtube-script-writer (long-form), cdeistopened/content-os (newsletter/
podcast writing, needs Gemini/Anthropic keys), agamm/video-agent (edits real footage; Grok part is paid).

## Excel bar: "impossible in Excel" (owner's standing request, 2026-11-09)
Every «أسرار Excel» episode must look heavy and jaw-dropping, never a basic shortcut or a known trick.
The hook is "this can't be Excel" in the first second, then a 2-second reveal of how (one formula, LAMBDA,
iterative calculation or a small VBA loop), and a real working file in files/ for «أريده».
Next ideas, roughly hardest first (build only what can really be made and shipped as a file):
- 3D first-person maze (Wolfenstein-style raycaster) drawn in cells with VBA, arrow keys to walk
- Tetris with rotation, line clears and score, in cells (VBA)
- Mandelbrot / Julia fractal from ONE dynamic-array formula + colour scale, zoom by changing a cell
- Conway's Game of Life with iterative calculation (no VBA), press F9 to step
- Sudoku solved by ONE recursive LAMBDA
- A tiny neural network that recognises a digit you draw in an 8x8 grid (weights in a sheet)
- Flappy Bird (done ep 6) / Pac-Man (done ep 7, BFS ghosts) / Space Invaders (next) in cells (VBA)
- Raytraced sphere with lighting computed per cell by formulas
- QR code generator with formulas only
- Music sequencer: cells as a piano roll that plays with Beep (VBA)
- Live analog clock drawn by a scatter chart + NOW() with iterative recalculation

## Focus after the first 4 days (owner's decision, 2026-11-12)
Numbers on day 4: family series = 3 of the top 4 videos (~700–1,200 views each); Excel only lands with famous
games (Snake 1,287 views, 9 comments) while abstract demos stall (3D maze 30); horror 315 views total, 0 subs.
Subscriber conversion is the bottleneck (3 subs from ~5k views).
- **Family first.** Keep the family queue the fullest; build new family episodes before anything else.
- **Excel = famous games only** (Snake, Tetris, Flappy, Pac-Man, Mario-style…) with the free file. Skip abstract demos.
- **Horror every other day**: its slot in episodes.json has `"every_days": 2, "anchor": "2026-11-13"`
  (publish.py skips the other days). Remove those two keys to go back to daily.
- **Every outro gives a reason to subscribe**: a yellow pill «🔔 اشترك ليصلك الدرس التالي» (family) /
  «🔔 اشترك لتصلك اللعبة التالية» (Excel) next to the main CTA, and the same line in the description.

## Horror channel look (owner's decision, 2026-11-09)
Heavy, dark horror that matches the channel logo (hooded pale face, glowing red eyes, red ring on black):
black and blood-red palette, deep shadows, fog, flicker, slow push-ins, sudden silence before the scare.
Dark anime-horror drawing style is fine; cute/chibi is NOT. Never gore, blood splatter or self-harm,
never aimed at children, always "not made for kids". Scary through atmosphere, sound and the last-second reveal.


## Production sequence & schedule (owner's decisions, 2026-11-12) — follow this every time
**Slots (episodes.json → settings.slots, Asia/Beirut) — UPDATED 2026-11-20 by the owner:** Excel daily 13:00 · Family DAILY 20:00 (was Tue+Fri) ·
Horror TWICE a day 18:00 + 22:00 (publish.py now guards per slot time, not per day, so re-runs never fill a slot twice).
Tell the owner when any series drops below 3 ready episodes. Local renders here: `--browser-executable=/usr/bin/google-chrome --concurrency=2`.
Playlists (original @tech3almashi, 2026-11-19): Excel `PLYdOHth1Xago`, Family `PLfUdrVKeKj4Y`, دفتر الجارة (horror channel) `PLcR-LdebtVbI`. An episode's own `"playlist"` field overrides the series playlist in `settings.playlists`; every دفتر الجارة episode gets `"playlist": "PLcR-LdebtVbI"` and other horror stories stay outside it. Every video (any series) ends with a teaser for the next one + a subscribe reason.

**Excel every other day (owner's decision, 2026-11-21):** the excel slot has `"every_days": 2, "anchor": "2026-11-21"` (13:00 on 21, 23, 25…). Remove both keys to go back to daily. Excel target stays 3 ready. The same day the owner asked to see the stickman look sooner: fam14-uniform → fam15-2fa → fam16-stranger moved to the front of the family queue (keeps their teaser chain), then the rest.

**Always keep episodes ahead** (owner's rule, updated 2026-11-20): never fewer than TWO ready in any series, and for the DAILY series
(Excel, Horror) aim for THREE, because a batch takes hours and needs the owner's PC. Check `episodes.json` ready count first and produce
until every series is at its target before anything else. Next Excel episode: the car racing game (ep13, promised by ep12).
Horror دفتر الجارة: eps 5–6 open with a cold-open of the scariest line (`COLD=<line> EP=<n> python3 work/daftar_new/build.py`), 7–8 open calmly,
as an A/B test — compare views after a few days.

**دفتر الجارة titles & pacing (owner's decision, 2026-11-19):** each episode's title is its own, drawn from what happens inside THAT episode's story (a suspenseful line about its content), ends with a teaser for the next one («انتظروا الحلقة القادمة…» / what comes next without spoiling), then «دفتر الجارة 📓 N»; ≤100 chars, ends #shorts. Not the old «دفتر الجارة 📓 الحلقة N: …» shape. First second of the video starts on the scary line. One episode per day at 22:00, never two the same day. Produce 4 episodes per PC session and keep 2 ready ahead. First two new episodes: compare their views against eps 1-4 before generalising.

**دفتر الجارة — standalone episodes (owner's decision, 2026-11-21):** eps 4–6 fell to 70–113 views vs 560–830 for eps 1–3 and ~1,000 for the old standalone horror shorts. Serial episodes need the viewer to have seen the earlier ones. From ep 9 on, every episode is a COMPLETE story in 15 s (scary first second → what happened → small twist), understandable with zero context, same world (Layla, 12, yellow jacket; notebook that writes the future; explain the notebook in line 1). No «الحلقة N» dependency in the story; keep the title shape. Eps 7–8 go out as already made. Temporary exception to the "3 ready" target: do not build more serial episodes; produce standalone ones only. Review views of 5–8 before generalising.

**دفتر الجارة recipe** (episodes are pre-rendered mp4 in `videos/horror/`, queue entry has `"video": "videos/horror/<file>.mp4"`, no composition):
1. Write 6 narration lines in MSA with full tashkeel (Layla, 12, short black bob, yellow jacket; notebook that writes the future; each ep ends on a hook).
2. TTS on the owner's PC (desktop-commander PowerShell): `ar-SA-HamedNeural`, rate +0%, pitch -2Hz, script `tts34.py` pattern in `...\kamera-bayt\out\layla_epN`;
   captions = same text without tashkeel (`lines.json`) so they match the voice exactly. Stage mp3s with device_stage_files.
3. Scenes: Colab T4 + Animagine XL 4.0 (notebook layla_test.ipynb), 6 images per episode 768x1344. Move images ONLY through GitHub
   (never Google Drive; the owner forbade it): print JPEG-base64 in a cell, put it in `window.name`, navigate the same tab to
   `github.com/adhamn75/techalmashi/new/main?filename=work/...` (owner is signed in), paste via a synthetic ClipboardEvent, commit; pull and decode in the sandbox.
   Then Runtime → Disconnect and delete runtime. Never click OAuth/consent dialogs; ask the owner.
4. Build: `work/layla` scripts (build.py/audio.py, env EP=N; PIL + ffmpeg, Ken-Burns, grain, vignette, drone + heartbeat + sting, loudnorm I=-15),
   check contact sheet, mux crf 27. Copy to `videos/horror/daftar-aljara-epN.mp4`, add the episode to `episodes.json` (status ready, `"playlist": "PLcR-LdebtVbI"`, title ends #shorts, description with teaser), push.
5. Send the owner the preview only for new styles; otherwise just report.
Colab/tts steps need his computer on (built-in browser + desktop-commander). Do not use Google Drive for anything.

## Spoken subscribe phrase (2026-11-23, small test, no look change)
Subs run ~1 per 1,000 views and the outro only shows a written pill. From the NEXT NEW episode of each series (ep13, fam17, next horror)
say a subscribe phrase of at most 4 words INSIDE the last voice line (e.g. «اشترك لتصلك اللعبة التالية»), not as an extra line, so length
and pacing stay the same. Already-ready episodes are NOT re-voiced. Measure subs per 1k views from `docs/history.json` before/after (baseline 2026-11-23: ~8 subs, ~11.9k views).
Retention data needs the `yt-analytics.readonly` scope, which the current token lacks: do not re-grant the token (risk to publishing); ask the owner for Studio
retention screenshots of 3 top + 3 bottom videos and feed them to the `yt-retention` skill. Planning skeleton: `docs/master_prompt.md`.

## Quota & publishing notes (2026-11-13)
- Both channels share ONE YouTube API project quota (10,000 units/day, resets 08:00 UTC). An upload costs ~1,600.
  publish.yml now runs at 08:20 UTC (and the watcher dispatches it after 08:15 UTC if GitHub's cron is late);
  the watcher reads comments every ~6 min; a refused comment reply pauses replies for 6 h (`.reply_blocked`).
- publish.py keeps going when one account fails and always saves the queue.
- Local renders here need `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
- `scripts/voice_timeline.py <ep>` trims the TTS mp3s to wavs and prints timeline voice entries.
