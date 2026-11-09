# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

Landscrawl: a free, open-source, 100% client-side web app. The user types a sentence and a hand-drawn SVG landscape is drawn live. No backend, no API calls, no AI model, no accounts, no analytics. Code MIT, drawings CC0. It started from an earlier prototype (Describble, MIT); the original copyright line stays in `LICENSE`.

## Commands

```bash
npm install
npm test                 # vitest, runs in Node
npm run typecheck        # tsc --noEmit (strict)
npm run build            # tsc + vite build, one self-contained dist/index.html
npm run dev
```

Single test file: `npx vitest run test/parser.test.ts`. Single test: `npx vitest run -t "negation"`.

## Pipeline (keep the stages pure and separate)

`parse(text, lang)` -> `SceneState` -> `buildScene(state, seed)` -> `Layer[]` -> `renderSvg` / `Stage`.
See `docs/ARCHITECTURE.md`. Only `src/render/stage.ts`, `src/ui/*` and `src/main.ts` may touch the DOM; `test/constraints.test.ts` enforces it, plus: no `Math.random` in scene code, no network calls, no runtime dependencies, strict CSP in `index.html`.

## Rules that are easy to break

- Words go in `src/lexicon/lexicon.en.json`, never in code. A new trait needs a field in `SceneState` (`scene/types.ts`), a patch key the tests accept, and drawing code.
- Plain mentions in the lexicon are written at 0.6 so intensity modifiers scale them ("heavy" 0.9, "light" 0.3).
- Archetypes and moods are `soft`: they fill gaps and never override explicit words. Negation is sticky.
- Colour words attach to the nearest following noun that has a `tint`.
- Same text + same seed must give byte-identical SVG. Each layer takes its own stream: `mulberry32(subSeed(seed, 'label'))`. `resolveScene` draws all its random numbers up front so unrelated words do not reshuffle defaults.
- Layer ids must be unique (they key gradients and the draw-in diff). Layer order is back to front.
- Placement is pure and tested: boats/whales only in water, buildings/trees only on land, nothing on roads. Use `inWater` and `ground.land`, never ad-hoc checks.
- Every path must keep working through `flatten` (supports M L H V C Q A Z, absolute and relative).
- `still: true` paths (stars, rain, snowflakes) are never jittered; gradient fills without `ink` are not outlined.
- With `prefers-reduced-motion` the boil, draw-in and parallax easing are off.
- English only on purpose. Other languages plug in through `registerLexicon` / `registerLanguage`.

## Not allowed

No accounts, backend, database, analytics, or AI/image-generation calls. No photo realism. Never copy other projects' names, logos or artwork. Nothing personal or secret in the repository.

## UI notes

- Styles are in `src/ui/style.css` (linked from `index.html`, inlined at build with the Bricolage Grotesque font, SIL OFL, in `src/ui/fonts/`). The look follows the earlier Describble site: night background, paper-coloured pill buttons, underlined text box, large art with a thin ring (no glow).
- The strict CSP is added only in the production build (`vite.config.ts`); in dev it would block Vite's module script.
