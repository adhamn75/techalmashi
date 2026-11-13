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
**Promised next Excel episode (ep 7 Pac-Man teaser «لعبة فضاء أسطورية»): Space Invaders in cells (VBA) — make it next.**
Horror code-drawn eps made: rules, frame481, elevator, camera, mirror, own number, closet, gallery (h08).

Family series (parents) — made: scam message, location, code, suspended, voice, gems, purchase, game-chat stranger (ep 8).
**Promised next (ep 8 teaser): QR code scam — make it next.** Still open: weak password vs passphrase ·
2-step verification in 10 s · fake Free-Fire/Roblox gem generator · screen-time setup on the phone ·
QR code scam · "send me the code you got" · public Wi-Fi · oversharing school uniform in photos ·
deepfake voice of a relative asking for money.

## Excel files for every Excel episode
Every Excel episode ships with its real file in `files/` (built by a script in `scripts/files/`, e.g. `make_cube3d.py`,
or VBA via pyOpenVBA like `snake.xlsm`), so commenters who ask can get it. Add an entry to `files/files_map.json`
(episode, title, file, reply text with the raw GitHub link; `videoId` once the video is on the channel). The `Auto-reply to file requests`
workflow (`scripts/auto_reply.py`, every 5 min, YouTube API, no vidIQ credits) reads that map and replies by itself to
comments like «اريده» — an entry needs its `videoId` to be answered. Because the file exists, the Excel CTA may say the file is in the comments.

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
**Slots (episodes.json → settings.slots, Asia/Beirut):** Excel daily 13:00 (famous heavy games, free file) · Family Tue + Fri 20:00
(explainers like «ابنك اتصل يطلب مالًا») · Horror daily 22:00 (motion-comic series «دفتر الجارة», one episode a day).
Playlists: Excel `PLYdOHth1Xago`, Family `PLfUdrVKeKj4Y`. Every video (any series) ends with a teaser for the next one + a subscribe reason.

**Always keep TWO unpublished episodes ahead** (owner's rule): whenever the ready queue of a series is below 2, make more before
anything else. Check `episodes.json` ready count first, then produce until each daily series has 2 ready.

**دفتر الجارة recipe** (episodes are pre-rendered mp4 in `videos/horror/`, queue entry has `"video": "videos/horror/<file>.mp4"`, no composition):
1. Write 6 narration lines in MSA with full tashkeel (Layla, 12, short black bob, yellow jacket; notebook that writes the future; each ep ends on a hook).
2. TTS on the owner's PC (desktop-commander PowerShell): `ar-SA-HamedNeural`, rate +0%, pitch -2Hz, script `tts34.py` pattern in `...\kamera-bayt\out\layla_epN`;
   captions = same text without tashkeel (`lines.json`) so they match the voice exactly. Stage mp3s with device_stage_files.
3. Scenes: Colab T4 + Animagine XL 4.0 (notebook layla_test.ipynb), 6 images per episode 768x1344. Move images ONLY through GitHub
   (never Google Drive; the owner forbade it): print JPEG-base64 in a cell, put it in `window.name`, navigate the same tab to
   `github.com/adhamn75/techalmashi/new/main?filename=work/...` (owner is signed in), paste via a synthetic ClipboardEvent, commit; pull and decode in the sandbox.
   Then Runtime → Disconnect and delete runtime. Never click OAuth/consent dialogs; ask the owner.
4. Build: `work/layla` scripts (build.py/audio.py, env EP=N; PIL + ffmpeg, Ken-Burns, grain, vignette, drone + heartbeat + sting, loudnorm I=-15),
   check contact sheet, mux crf 27. Copy to `videos/horror/daftar-aljara-epN.mp4`, add the episode to `episodes.json` (status ready, title ends #shorts, description with teaser), push.
5. Send the owner the preview only for new styles; otherwise just report.
Colab/tts steps need his computer on (built-in browser + desktop-commander). Do not use Google Drive for anything.

## Quota & publishing notes (2026-11-13)
- Both channels share ONE YouTube API project quota (10,000 units/day, resets 08:00 UTC). An upload costs ~1,600.
  publish.yml now runs at 08:20 UTC (and the watcher dispatches it after 08:15 UTC if GitHub's cron is late);
  the watcher reads comments every ~6 min; a refused comment reply pauses replies for 6 h (`.reply_blocked`).
- publish.py keeps going when one account fails and always saves the queue.
- Local renders here need `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
- `scripts/voice_timeline.py <ep>` trims the TTS mp3s to wavs and prints timeline voice entries.
