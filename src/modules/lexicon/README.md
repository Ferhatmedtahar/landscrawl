# lexicon

The words the program understands, and the text clean-up needed to look them up.

| File | Role |
| --- | --- |
| `lexicon.en.json` | Every English word, as data: which trait it sets, colours, intensity words, stopwords |
| `index.ts` | Builds fast lookup tables, finds a word exactly / by plural / by typo, and holds the registry for more languages (`registerLexicon`) |
| `normalize.ts` | Lower-casing, accent stripping, English plurals (`stem`), edit distance |

Rules: words live in the JSON, never in code. A new trait needs a field in `scene/model/types.ts`. See `docs/CONTRIBUTING.md` for adding words or a language. May import `shared` only.
