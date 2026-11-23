# Master prompt — one structure for every series

Purpose: every new episode (any series) is planned from the same skeleton, so hooks, scenes and
character looks stay consistent. It does **not** change a series' look: the per-series blocks below
restate what the repo already does. Fill the `{}` fields, give the result to Claude, then follow
`CLAUDE.md` (and the `yt-script` / `yt-package` skills) to build it.

## Shared skeleton

```
You write and direct Shorts for the channel «تك عالماشي» in Modern Standard Arabic (فصحى), fully diacritized
for the voice (ar-SA-HamedNeural), undiacritized for captions.
Series: {series} | Audience: {audience} | Look (fixed, never drift): {look}
Fixed characters (same description every time): {characters}

For each episode give:
1) Hook: the striking claim or moment, visible from frame 0 (no intro).
2) Voice lines: 4-5 short lines, max ~15 s of speech at +15 %. Numbers as digits in the caption.
3) 5-8 scenes: number, seconds, what is on screen, camera/motion move, SFX cue.
4) Reveal or fix in <= 2 steps. It must be real and doable.
5) Closing: one-line teaser for the NEXT planned episode + a spoken subscribe phrase (<= 4 words, inside the last line).
6) Title (<= 100 chars, ends #shorts), description (teaser + subscribe line), tags.
Never copy a previous episode and swap words: change layout, scene colors, motion, structure.
```

## Series blocks

**أسرار Excel** (`series: excel`)
- Audience: Arabic speakers who use Excel at work or school.
- Look: code-drawn (Remotion), host ShieldBuddy («Mokaab»), blue + orange glow; real file in `files/`.
- Episode = famous game or striking visual done inside Excel; lead the caption with the trick (BFS ghosts, flood-fill, merge rule).
- Sign-off: «تك عالماشي · خلّيك ذكي!»

**احمِ أطفالك على الإنترنت** (`series: family`)
- Audience: PARENTS (never made-for-kids).
- Look: code-drawn stickman (`StickPro`), light pastel scenes, scammer/hacker in red. Different layout from the previous episode.
- Episode = one concrete danger to the child → what the parent got wrong → fix in 2 steps. Title leads with the concrete moment («هل فعلاً…؟» form is under test).

**Horror** (`series: horror`, channel @Horrorshorts-l9i)
- Look: black + blood-red, fog, flicker, slow push-ins; dark anime-horror, never cute, never gore, not for kids.
- Code-drawn eps: «object emoji + impossible detail + twist» titles. دفتر الجارة: standalone 15 s story, Layla (12, short black bob, yellow jacket) named in the title, notebook explained in line 1.

## Not changed on purpose
Posting slots, the one-reply-per-person guards, free-only tools, the teaser-to-next-episode rule.
