# Contributing

Thanks for helping. The two most useful kinds of contribution are **words** and **drawings**.

```bash
npm install
npm test          # must stay green
npm run build
```

Please keep the project rules: no network calls, no runtime dependencies, no AI, no analytics, nothing personal in the repo. Every drawing is original (CC0); do not copy other people's artwork.

## Add a word

Words live in `src/lexicon/lexicon.en.json`. Find the entry that already does what you want and add your word to its `keys`. That is a one-line change:

```json
{ "keys": ["fog", "foggy", "murky"], "set": { "weather.fog": 0.6 } }
```

Plurals and one typo are handled for you, and phrases are fine (`"golden hour"`). A key may appear only once in the whole file; the tests tell you if it already exists.

### Writing a new entry

```json
{
  "keys": ["storm", "stormy", "tempest"],
  "set": { "weather.rain": 0.8, "weather.wind": 0.7, "weather.clouds": 0.9 },
  "single": { },
  "soft": false,
  "tint": "skyTint",
  "scale": 0.5,
  "maybe": ["objects.lighthouse"]
}
```

| Field | Meaning |
| --- | --- |
| `keys` | words or phrases that trigger it |
| `set` | what it changes (see below) |
| `single` | used instead of `set` after "one", "a lone", "a single" |
| `soft` | archetype or mood: fills gaps, never overrides what the text said |
| `tint` | palette slot a colour word in front of it paints: `skyTint`, `groundTint`, `waterTint`, `foliageTint` |
| `scale` | default size multiplier (a pond is a small lake) |
| `maybe` | trait keys the seed may add (a coast may get a lighthouse) |

`set` keys:

- `"time": "dawn" | "day" | "sunset" | "dusk" | "night"`
- `"weather.clouds" | "weather.rain" | "weather.snow" | "weather.fog" | "weather.wind": 0..1`. Write a plain mention at **0.6**: "heavy" (0.9) and "light" (0.3) scale from that.
- `"celestial.sun": true`, `"celestial.moon": "none" | "crescent" | "half" | "full"`, `"celestial.stars"`, `"celestial.aurora" | "celestial.rainbow": 0..1`
- `"terrain+": ["mountains", "lake"]` and `"objects+": ["cabin"]` add to a list. The names must exist in `TERRAINS` / `OBJECTS` in `src/scene/types.ts`.
- `"vegetation.forest" | "pine" | "palm" | "grass" | "flowers" | "cactus" | "deadTrees": 0..1`, `"vegetation.loneTree": true`
- `"surface.snowCover": 0..1`, `"palette.skyTint"`, `"palette.groundTint"`, `"palette.waterTint"`, `"palette.foliageTint": "#rrggbb"`
- `"mood.cozy" | "lonely" | "grand" | "spooky": 0..1`, `"details.litWindows" | "smoke" | "reflection" | "fireflies": true`

A word listed under several traits turns all of them on: that is how archetypes like `sahara` work. `src/scene/types.ts` is the model; `test/lexicon.test.ts` checks every key and value, so a typo in a patch fails the tests.

Colours, intensity words and stopwords have their own lists at the top of the file (`colors`, `modifiers`, `stopwords`, `negators`).

### Add a test

If the word changes behaviour, add a line to the matching group in `test/parser.test.ts`:

```ts
['a tempest', 'rain'], ...
```

Words people use that are not understood yet are best reported as issues with the sentence, the picture you expected and the one you got.

## Add a language

1. Copy `src/lexicon/lexicon.en.json` to `lexicon.<code>.json`, translate the `keys` (leave `set`, `tint`, `scale`, `maybe` alone) and set `"lang": "<code>"`.
2. Register it in `src/lexicon/index.ts`:
   ```ts
   import fr from './lexicon.fr.json'
   registerLexicon(fr as unknown as RawLexicon)
   ```
3. Add UI strings in `src/ui/i18n.ts` with `registerLanguage({ code: 'fr', name: 'Français', dir: 'ltr', strings: {...} })`. Use `dir: 'rtl'` for right-to-left languages; the page switches direction by itself.
4. Add a few cases to `test/languages.test.ts` (the toy language there shows the shape).

The engine is language-agnostic: phrases, plurals (`stem` in `src/parser/normalize.ts` is English-only; replace it for languages with other plural rules), typos, negation, intensity and colours all come from the lexicon. Current limit: colour words must come before the noun they paint.

## Add or improve a drawing

- Drawings live in `src/scene/layers/*.ts` (backgrounds) and `src/scene/shapes.ts` (trees, buildings, creatures).
- Draw in local units around a feet point `(0, 0)` with `Ctx`; the scale for distance is applied for you.
- Colours go through `pal.lit(hex, haze)` so they follow the time of day and weather.
- New object kinds need: an entry in `OBJECTS` (`types.ts`), a drawer in `shapes.ts`, a size in `placement.ts`, and a word in the lexicon. `test/scenery.test.ts` runs every object kind through the placement rules.
- Never use `Math.random()`; use the seeded PRNG (`mulberry32(subSeed(seed, 'label'))`). A test enforces it.
- Preview: `npm run dev`.

## Before you open a pull request

`npm test` and `npm run build` must pass. Keep commits small and focused.
