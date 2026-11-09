# stage

The live drawing in the page. This is one of the few places that may touch the DOM.

| File | Role |
| --- | --- |
| `stage.ts` | Owns the `<svg>`: draws layers, boils the lines, settles after typing, draws new paths in, fades removed layers, parallax |
| `motion.ts` | The pure rules behind it (timings, which layers or paths are new, parallax maths), so they can be tested in Node |

With `prefers-reduced-motion` the boil, draw-in and parallax easing are off. May import `shared`, `scene` and `render`.
