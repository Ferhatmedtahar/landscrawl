# parser

Turns a sentence into a `SceneState`. Pure and deterministic: the same text always gives the same state.

`parse(text, lang)` runs: `tokenize` (words with positions) -> `match` (longest phrase, then plural, then typo) -> `negation` ("no clouds") -> `modifiers` (heavy, tiny, two) -> colours -> apply in text order. `parseDetailed` also returns `chips`, the recognised pieces with character spans, so the UI can offer "remove this" (`chips.ts`).

May import `shared`, `lexicon` and the types in `scene/model`. It never draws anything.
