# render

Turns layers into SVG text. Pure, no DOM.

| File | Role |
| --- | --- |
| `jitter.ts` | Flattens SVG paths (M L H V C Q A Z) and wobbles them with noise: the hand-drawn look |
| `draw.ts` | One layer -> list of `DrawItem`s (fills, hatch, double ink outline) |
| `svgRenderer.ts` | A whole scene -> one SVG string, with aspect-ratio crop (used for export and tests) |

`still: true` paths (stars, rain) are never jittered. May import `shared` and `scene`.
