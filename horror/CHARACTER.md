# The hooded one — character bible (horror channel)

One recurring villain for every horror episode, matching the channel logo. Paste the CHARACTER block
into any image tool (Flow, Gemini, our own `Horror stills` workflow) so every shot shows the same figure.

## CHARACTER (copy as is)
a tall hooded figure in a long black cloak, the hood deep and pointed, a pale grey-white face with sunken cheeks,
thin dark lips, long black hair strands falling over the face, two glowing blood-red eyes, a thin red rim light
along the edge of the hood, standing perfectly still

## STYLE (end of every prompt)
dark anime horror illustration, black and blood-red palette, low-key lighting, deep shadows, thin fog,
film grain, cinematic, vertical 9:16, highly detailed

## NEVER
cute, chibi, cartoon, bright colours, daylight, blood, gore, wounds, weapons, children, text, watermark

## In code
`src/horror/HoodedFace.tsx` draws the same face in SVG (pale face, red eyes, black hood with red rim).
Stills made by the workflow land in `public/horror/<episode>/stills/` and are animated in Remotion
(camera moves, fog, flicker, glowing eyes), optionally with 2.5D parallax from `depth.yml`.
