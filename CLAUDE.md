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

Family series (parents): fake "account suspended" message · stranger in a game chat asking for photos (handled at
pattern level, never graphic) · location sharing left on · in-app purchase trap · weak password vs passphrase ·
2-step verification in 10 s · fake Free-Fire/Roblox gem generator · screen-time setup on the phone ·
QR code scam · "send me the code you got" · public Wi-Fi · oversharing school uniform in photos ·
deepfake voice of a relative asking for money.

## Publishing mode (current)
The YouTube key is not set up (the `YT_CLIENT_SECRET` GitHub secret could not be saved), so publishing is MANUAL:
each day render the two new episodes, then send the owner the MP4s plus copy-ready title, description and schedule
time (Excel 13:00, family 20:00 Beirut). Once `youtube_token.enc` exists, `publish.yml` uploads by itself.

## Adopted third-party skills (`.claude/skills/`, MIT — see `third_party/LICENSES.txt`)
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
