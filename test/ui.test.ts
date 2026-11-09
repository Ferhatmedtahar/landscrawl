import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { removeChip } from '../src/modules/parser/chips'
import { parse, parseDetailed } from '../src/modules/parser/parse'
import { tokenizeSpans } from '../src/modules/parser/tokenize'
import { buildScene } from '../src/modules/scene/buildScene'
import { resolveScene } from '../src/modules/scene/model/resolve'
import { describeScene } from '../src/modules/ui/describe'
import { EXAMPLES, PILL_CHARS, shorten } from '../src/modules/ui/examples'
import { fileName, pngSize, svgForDownload, withSize } from '../src/modules/ui/export'
import { langMeta } from '../src/modules/ui/i18n'
import { decodeHash, encodeHash, hasHashState, MAX_TEXT, type ShareState } from '../src/modules/ui/share'
import { renderSvg } from '../src/modules/render/svgRenderer'

const base: ShareState = { seed: 7, text: 'default', lang: 'en', ratio: '16:9' }

describe('share links', () => {
  const cases: ShareState[] = [
    { seed: 0, text: '', lang: 'en', ratio: '1:1' },
    { seed: 4294967295, text: 'sunset over snowy mountains, a small cabin', lang: 'en', ratio: '9:16' },
    { seed: 123, text: 'a & b = c # d + e ? f %20 "quotes" \'single\'\nnew line\ttab', lang: 'en', ratio: '4:3' },
    { seed: 99, text: 'café ☀️ 山 مرحبا', lang: 'en', ratio: '16:9' },
  ]
  it.each(cases)('round trip: %j', (s) => expect(decodeHash(encodeHash(s), base)).toEqual(s))
  it('has the documented shape', () => {
    expect(encodeHash({ seed: 5, text: 'foggy lake', lang: 'en', ratio: '16:9' })).toBe('#s=5&t=foggy%20lake&l=en&r=16%3A9')
  })
  it('falls back field by field when parts are missing or invalid', () => {
    expect(decodeHash('', base)).toEqual(base)
    expect(decodeHash('#s=abc&r=2:1&l=xx', base)).toEqual(base)
    expect(decodeHash('#s=99999999999', base).seed).toBe(base.seed)
    expect(decodeHash('#s=-5', base).seed).toBe(base.seed)
    expect(decodeHash('#t=hello', base)).toEqual({ ...base, text: 'hello' })
  })
  it('never throws and caps the text length', () => {
    expect(() => decodeHash('#t=%E0%A4%A', base)).not.toThrow()
    expect(decodeHash('#t=' + 'a'.repeat(5000), base).text).toHaveLength(MAX_TEXT)
  })
  it('detects a hash that carries state', () => {
    expect(hasHashState('#s=1')).toBe(true); expect(hasHashState('')).toBe(false); expect(hasHashState('#other')).toBe(false)
  })
  it('a restored link redraws the identical picture', () => {
    const s: ShareState = { seed: 31337, text: 'foggy lake at dawn, one boat', lang: 'en', ratio: '4:3' }
    const back = decodeHash(encodeHash(s), base)
    const draw = (x: ShareState) => renderSvg(buildScene(parse(x.text), x.seed), { ratio: x.ratio })
    expect(draw(back)).toBe(draw(s))
  })
})

describe('chips', () => {
  it('lists what was understood, with its modifiers', () => {
    const chips = parseDetailed('heavy rain over a tiny village, purple mountains').chips.map((c) => c.label)
    expect(chips).toEqual(['heavy rain', 'tiny village', 'purple mountains'])
  })
  it('skips pure filler nouns and negated traits', () => {
    expect(parseDetailed('sky, no clouds, a lake').chips.map((c) => c.label)).toEqual(['lake'])
  })
  it('spans point at the right characters in the original text', () => {
    const text = 'Foggy LAKE, at dawn'
    for (const c of parseDetailed(text).chips) expect(text.slice(c.start, c.end)).toBe(c.label)
  })
  it('removing a chip removes its words and tidies punctuation', () => {
    const text = 'sunset over snowy mountains, a small cabin with a lit window, pine forest'
    const chips = parseDetailed(text).chips
    const cabin = chips.find((c) => c.label === 'small cabin')!
    expect(removeChip(text, cabin)).toBe('sunset over snowy mountains, with a lit window, pine forest')
    const forest = chips.find((c) => c.label === 'pine forest')!
    expect(removeChip(text, forest)).toBe('sunset over snowy mountains, a small cabin with a lit window')
    expect(parse(removeChip(text, forest)).vegetation.pine).toBe(0)
  })
  it('removing every chip one by one empties the scene it described', () => {
    let text = 'foggy lake, one boat, pine forest'
    for (let i = 0; i < 5 && parseDetailed(text).chips.length; i++) text = removeChip(text, parseDetailed(text).chips[0]!)
    const s = parse(text)
    expect(s.terrain).toEqual([]); expect(s.objects).toEqual([]); expect(s.weather.fog).toBe(0)
  })
  it('works with accents, capitals and apostrophes', () => {
    const spans = tokenizeSpans("It's a Café, near Éze")
    expect(spans.map((t) => t.text)).toEqual(['its', 'a', 'cafe', '|', 'near', 'eze'])
  })
})

describe('surprise sentences', () => {
  it('has at least 40, all different', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(40); expect(new Set(EXAMPLES).size).toBe(EXAMPLES.length)
  })
  it('every one is fully understood and draws a scene', () => {
    for (const e of EXAMPLES) {
      const p = parseDetailed(e)
      expect(p.state.unknownWords, e).toEqual([]); expect(p.state.unusedWords, e).toEqual([])
      expect(p.chips.length, e).toBeGreaterThan(1)
      expect(renderSvg(buildScene(p.state, 11)), e).not.toMatch(/NaN|undefined/)
    }
  })
  it('together they cover desert, ice, sea, mountains, forest, night and storms', () => {
    const all = EXAMPLES.join(' ')
    for (const w of ['dunes', 'glacier', 'sea', 'mountains', 'forest', 'night', 'rain', 'volcano', 'canyon', 'aurora']) expect(all, w).toContain(w)
  })
})

describe('accessibility text', () => {
  const d = (t: string) => describeScene(resolveScene(parse(t), 3))
  it('describes time, terrain, objects and weather in plain words', () => {
    const s = d('sunset over snowy mountains, a cabin, heavy rain')
    expect(s).toContain('sunset'); expect(s).toContain('mountains'); expect(s).toContain('a cabin'); expect(s).toContain('heavy rain')
  })
  it('names the sky', () => expect(d('night, full moon, stars')).toMatch(/full moon.*stars|stars/))
  it('always returns a sentence, even for nonsense', () => expect(d('zzz')).toMatch(/^A hand-drawn landscape at \w+: .+\.$/))
})

describe('export helpers', () => {
  it('png size is 2x height with the right shape', () => {
    expect(pngSize('16:9')).toEqual({ w: 3200, h: 1800 }); expect(pngSize('1:1')).toEqual({ w: 1800, h: 1800 })
    expect(pngSize('9:16').w / pngSize('9:16').h).toBeCloseTo(9 / 16, 2)
  })
  it('adds explicit pixel dimensions so viewers size the image', () => {
    expect(withSize('<svg xmlns="x" viewBox="0 0 1 1"></svg>', 10, 20)).toBe('<svg width="10" height="20" xmlns="x" viewBox="0 0 1 1"></svg>')
  })
  it('svg download is a standalone document with no scripts or external references', () => {
    const svg = svgForDownload(renderSvg(buildScene(parse('lake at night with a cabin'), 5), { ratio: '1:1' }), '1:1')
    expect(svg.startsWith('<?xml')).toBe(true); expect(svg).toContain('width="900"')
    expect(svg).not.toMatch(/<script|href=|xlink|http:\/\/(?!www\.w3\.org)/)
  })
  it('file names carry the seed', () => expect(fileName(42, 'png')).toBe('landscrawl-42.png'))
})

describe('i18n', () => {
  it('English is left to right and falls back for unknown codes', () => {
    expect(langMeta('en').dir).toBe('ltr'); expect(langMeta('zz').code).toBe('en')
    expect(langMeta('en').strings.removeChip('rain')).toContain('rain')
  })
})

describe('example pills', () => {
  it('shortens long sentences with an ellipsis and leaves short ones alone', () => {
    expect(shorten('foggy lake')).toBe('foggy lake')
    const long = shorten('sunset over snowy mountains, a small cabin with a lit window')
    expect(long.length).toBeLessThanOrEqual(PILL_CHARS)
    expect(long.endsWith('…')).toBe(true)
    expect(long).not.toMatch(/[,\s]…$/)
    for (const e of EXAMPLES) expect(shorten(e).length).toBeLessThanOrEqual(PILL_CHARS)
  })
})

describe('index.html static text', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const S = langMeta('en').strings
  it('has the English copy baked in so crawlers and no-JS visitors see it', () => {
    for (const t of [S.kicker, S.headline, S.lede, S.examplesTitle, S.privacy, S.license, ...S.how]) expect(html, t).toContain(t)
  })
  it('has the basic SEO tags', () => {
    expect(html).toMatch(/<title>[^<]{10,60}<\/title>/)
    expect(html).toMatch(/<meta name="description" content="[^"]{70,160}"/)
    for (const t of ['rel="canonical"', 'property="og:image"', 'name="twitter:card"', 'application/ld+json']) expect(html).toContain(t)
  })
  it('links to the author site in the footer', () => expect(html).toContain('href="https://ferhatmedtahar.dev"'))
})
