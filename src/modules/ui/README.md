# ui

The page around the drawing. May touch the DOM and may import every other module.

| File | Role |
| --- | --- |
| `app.ts` | Wires the page: text box, chips, buttons, examples, share link |
| `i18n.ts` | Interface strings per language (`registerLanguage`) |
| `examples.ts` | Example sentences for "Surprise me" and the cycling placeholder |
| `describe.ts` | The plain-English sentence for screen readers |
| `share.ts` | Share link in the URL hash |
| `export.ts` | PNG and SVG download |
| `topo.ts` | The contour-line background |
| `style.css`, `fonts/` | Styles, and the Bricolage Grotesque font (SIL OFL) |

No network calls, no analytics, no storage. `index.html` carries a strict CSP in the production build.
