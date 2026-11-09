# Architecture

```
src/
  parser/    parse.ts, tokenize.ts, normalize.ts, match.ts, negation.ts, modifiers.ts, chips.ts
  lexicon/   lexicon.en.json, index.ts (builds lookup tables, registers languages)
  scene/     types.ts, resolve.ts, palette.ts, buildScene.ts, geometry.ts, profiles.ts, placement.ts, shapes.ts, layers/*.ts
  render/    prng.ts, jitter.ts, draw.ts, svgRenderer.ts, stage.ts, motion.ts
  ui/        app.ts, share.ts, export.ts, describe.ts, examples.ts, i18n.ts
  main.ts
test/        one file per area; run in Node, no browser
```

Each stage is a pure function you can run in a unit test. Only `render/stage.ts`, `ui/*` and `main.ts` touch the DOM, and a test (`test/constraints.test.ts`) enforces that the rest never reads `document`, `window`, storage or the network.

## 1. Parse: text to `SceneState`

`parse(text, lang)` is deterministic.

1. **Tokenise.** Words keep their character positions; punctuation becomes a clause boundary. Accents are stripped for matching.
2. **Match.** At each position the longest phrase wins (3 words, 2, 1). A phrase is looked up exactly, then by stem (plurals), then, for single words of 5+ letters with the same first letter, with edit distance 1 (a swap counts as one). Confidence is 1, 0.9, 0.6 for exact, stem, typo.
3. **Negation** (`negation.ts`). "no", "without", "not", "minus" mark the next trait within 3 tokens, then continue through "or"/"nor". Clause boundaries stop them. A negator that reaches nothing is reported as unused.
4. **Modifiers** (`modifiers.ts`). Level words ("heavy" 0.9, "light" 0.3), size words ("tiny", "huge") and counts ("two", "a lone") attach to the nearest following trait. Plain mentions are written at 0.6 in the lexicon, so a level scales them (heavy rain = 0.9).
5. **Colours** paint the nearest following noun that has a palette slot (`sky`, `ground`, `water`, `foliage`).
6. **Apply** in text order. Later words override earlier ones, except:
   - negation is sticky (a later mention cannot undo "no fog");
   - **soft** entries (archetypes and moods like `haunted`, `winter`, `cold`) only fill gaps and never override what the text said explicitly.

Output: the `SceneState` from the spec, plus `scale`, `counts`, `optional` (hints the seed may realise), `unknownWords` and `unusedWords`. `parseDetailed` also returns `chips` with character spans so the UI can offer "remove this".

## 2. Build: `SceneState` + seed to layers

`resolveScene` fills every "not mentioned" from the seed. It draws all its random numbers up front, so typing a new word never reshuffles unrelated defaults. `makePalette` derives colours from time, weather, tints and snow cover.

`buildScene(state, seed)` returns layers, back to front:

| # | Layer ids | Notes |
| - | --- | --- |
| 1 | `sky` | gradient from time, greyed by weather and tints |
| 2 | `celestial` | sun, moon phases, stars, aurora, rainbow, glows |
| 3 | `clouds` | count and size from `weather.clouds` |
| 4-5 | `far`, `terrain-0`, `terrain-1` | ridges from seeded noise: mountains, hills, dunes, mesa, canyon, volcano, glacier, valley; snow caps and shadow facets |
| 6 | `ground-mid`, `sea`, `lake`, `river` | water shapes come from `waterGeometry` (also used for placement) |
| 7 | `ground-near` | beach, bank, sea cliff |
| 8-9 | `road`, `vegetation`, `objects`, `glow`, `fireflies` | see below |
| 10 | `foreground` | grass tufts, rocks, flowers, drifts |
| 11 | `fog`, `rain`, `snow`, `wind` | only when asked for |
| 12 | `paper` | grain, vignette, frame line |

**Placement** (`placement.ts`) is pure and tested. Boats and whales are only accepted where `inWater` is true (and off the beach strip), buildings and trees only where `ground.land` is true (never in water, on a cliff, or on the road). Overlaps are rejected, counts are honoured when there is room, and anything with nowhere to go is reported in `skipped`. Objects are placed first so trees keep clear of them. Lit windows, campfires and lighthouse beams add a `glow` layer at dusk and night.

## 3. Render

`drawLayer(layer, {seed, variant, amp, sketch})` turns a layer into `DrawItem`s. Paths are parsed (M L H V C Q A Z, absolute and relative) and flattened into short straight pieces, then each point moves by coherent 2D value noise plus a little shake. Opaque fills get two outline strokes with different jitter; translucent shadow facets get a hatch pattern. The item list has the same structure for every variant, which is what lets the stage swap only the `d` strings when it boils.

`renderSvg` is the pure string renderer (used for tests and export). `Stage` is the live DOM version: four variants cycled every 140 ms, jitter 2.6 units while typing and 1.1 once settled (600 ms), new layers drawn in with `stroke-dashoffset` (400 ms), removed layers faded, parallax on drag or tilt, reduced motion disables all of it.

## Determinism

Same text and same seed give byte-identical SVG (`test/determinism.test.ts`, `test/render.test.ts`). The seed is a 32-bit integer; each layer derives its own stream with `subSeed(seed, label)`, so adding a layer does not disturb the others.

## Share links and export

`#s=<seed>&t=<text>&l=<lang>&r=<ratio>`, updated 300 ms after the last change with `history.replaceState`. SVG export is the settled sketch with explicit pixel size. PNG export draws that SVG onto an offscreen canvas at 2x. The drawing has no text, so no fonts need embedding.

## Coordinates

The scene is 1600 x 900 units. Ridges and ground run 64 units past each edge so parallax never shows a seam. Other aspect ratios crop around the centre.
