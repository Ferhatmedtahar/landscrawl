# shared

Tiny pure helpers used by several modules. Depends on nothing.

| File | What it gives you |
| --- | --- |
| `prng.ts` | `mulberry32(seed)` seeded random numbers, `subSeed(seed, label)` for an independent stream per layer |
| `noise.ts` | 1D and 2D value noise (`makeNoise1D`, `noise2`) |
| `color.ts` | `mix`, `shade` and other hex colour maths |

Rules: no DOM, no `Math.random`, no imports from other modules. If a helper needs to know about scenes, words or the page, it does not belong here.
