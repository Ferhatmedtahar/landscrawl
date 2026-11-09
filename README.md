# Landscrawl

Type a sentence and a landscape gets drawn while you type, in pencil, in your browser.

![License: MIT](https://img.shields.io/badge/code-MIT-blue) ![Drawings: CC0](https://img.shields.io/badge/drawings-CC0-lightgrey) ![No AI](https://img.shields.io/badge/AI-none-green) ![No backend](https://img.shields.io/badge/backend-none-green)

**Try it: [landscrawl.vercel.app](https://landscrawl.vercel.app)**

![Typing a sentence: the scene grows word by word](docs/demo.gif)

```text
sunset over snowy mountains, a small cabin with a lit window, pine forest
foggy lake at dawn, one boat, no clouds
sahara dunes at night, full moon, a lone palm
```

![Six landscapes from six sentences](docs/gallery.png)

There is no AI in it, no account, and no server. The sentence is read by plain rules, word by word, and the picture is built from layers (sky, mountains, water, trees, things) with a seed. The same sentence and seed always give the same drawing. Press Re-roll if you want another one.

You can download the result as an SVG or a PNG in 16:9, 4:3, 1:1 or 9:16, or copy a link. The link carries the sentence in the URL hash, which browsers never send to anyone, so sharing needs no backend either.

## Where it comes from

Landscrawl started as a fork of [Describble](https://github.com/gasparegas/describble) ([describble.com](https://describble.com)), a small open-source project that draws a character avatar from a description. I liked the idea a lot: a text box that is the whole interface, a drawing that trembles while you type, a parser that tells you honestly what it did not understand. I wanted the same thing for places instead of faces.

So the idea, the first version of the page and the parser approach are Describble's. The landscape lexicon, the scene builder, the renderer and the topographic look are new here. Describble is MIT, and its copyright line is kept in [LICENSE](LICENSE). If you like this, go and look at the original too.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # one self-contained dist/index.html
```

Node 20 or newer (`.nvmrc` has 22). There are no runtime dependencies; Vite, TypeScript and Vitest are only used to build and test. The build is a single HTML file of about 160 KB, font included, and it also opens straight from disk.

## What it understands

Time of day, sky, weather, kinds of land and water, plants, and a list of things you can put in the scene (a cabin, a boat, a lighthouse, a camel, a campfire and so on). A few habits make it forgiving:

- Later words win: "day ... night" is night.
- Negation works, even on something you said earlier: `no clouds`, `without snow or wind`.
- Strength and size words scale things: `heavy rain`, `a few clouds`, `tiny village`, `two boats`.
- A colour paints the nearest noun after it: `red sky`, `purple mountains`.
- A small typo in a longer word is forgiven (`mountians`).
- Whatever you do not mention is filled in from the seed, so the picture stays steady while you type.

The full list of words is in `src/lexicon/lexicon.en.json`. Anything it does not know is shown under the text box instead of being dropped silently.

## Limits

- It draws a kind of place, not a real one. `sahara` gives you dunes and warm light, not a map.
- The typo tolerance is sometimes too eager on short words (`horse` can become `house`).
- Colours go before the noun, not after.
- A bridge needs water to cross; without any, it is left out.
- English only for now. A new language is one lexicon file plus the UI strings.

## Made by

Built by [Ferhat Mohamed Tahar](https://github.com/Ferhatmedtahar) ([ferhatmedtahar.dev](https://ferhatmedtahar.dev)), on top of the idea and first page from Describble (see above). Questions or ideas: open an issue at [github.com/Ferhatmedtahar/landscrawl](https://github.com/Ferhatmedtahar/landscrawl/issues).

## Contributing

Missing a word, or got a drawing that looks wrong? Open an issue with the sentence. To add words or a language, see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md); [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the pieces fit.

## Licence

Code is MIT and the drawings are CC0, so use them anywhere. See [LICENSE](LICENSE) and [LICENSE-ASSETS](LICENSE-ASSETS). The font is Bricolage Grotesque under the SIL Open Font License.
