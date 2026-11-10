# Story-to-shots prompt system (kept from the owner, 2026-11-10)

Source: a template from a "Flow + automation" video the owner shared. Not used yet; kept to adapt.
The idea, in the order it asks for things:

1. One short story, split into N linked scenes that fit the video length.
2. One detailed, fixed prompt per character (face, hair, clothes, props) + one for each place,
   pasted into every shot where that character/place appears, so they stay the same.
3. One fixed STYLE line appended to every prompt.
4. An IMAGE prompt per scene (what is in the frame), all listed in order.
5. A separate VIDEO prompt per scene (only the motion: camera move, what moves, sound cue, seconds).
6. The narration written last, matched to the scenes.

How it maps onto this repo:
- 2 + 3 = `horror/CHARACTER.md` and `character` / `style` in `horror/stills.json`.
- 4 = the `shots` of an episode in `horror/stills.json` (rendered free by the Horror stills workflow).
- 5 = motion done in Remotion (push-ins, fog, flicker, glow) and/or 2.5D parallax with `depth.yml`.
  A real image-to-video model only if a free, commercially usable one runs on the GitHub runner.
- 6 = `voice/lines.json` (TTS workflow, word timings for synced captions).

Original request (Arabic), for reference:
اكتب قصة رعب قصيرة مدتها دقيقة من 10 مشاهد مترابطة؛ برومبت صورة لكل مشهد؛ برومبت منفصل لتحويل كل صورة
إلى فيديو؛ برومبتات الصور متتالية ثم برومبتات الفيديو بنفس الترتيب؛ برومبت تفصيلي لكل شخصية لضمان ثباتها؛
وفي النهاية تعليق صوتي بالعربية.
