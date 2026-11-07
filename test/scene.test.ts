import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser/parse'
import { renderSvg } from '../src/render/svgRenderer'
import { buildScene } from '../src/scene/buildScene'
import { waterGeometry, inWater } from '../src/scene/geometry'
import { makePalette } from '../src/scene/palette'
import { resolveScene } from '../src/scene/resolve'
import { emptyScene } from '../src/scene/types'

const SENTENCES = [
  '', 'zzz qqq', 'sunset over snowy mountains, a small cabin with a lit window, pine forest',
  'foggy lake at dawn, one boat, no clouds', 'sahara dunes at night, full moon, a lone palm',
  'arctic glacier with icebergs under the northern lights', 'tropical island beach at noon, sea, palm trees',
  'canyon at sunset, red mesa, river', 'heavy rain over hills, a storm, lake', 'coast with cliffs and a lighthouse, sea at dusk',
  'volcano at night with smoke, starry sky', 'blizzard on a frozen lake, tundra', 'oasis with a waterfall', 'haunted swamp, dead trees',
  'savanna at dawn, lots of flowers', 'fjord in winter, crescent moon', 'misty valley, red sky, purple mountains, green water',
  'desert badlands, sandstorm', 'alpine meadow, spring, river', 'mediterranean sea cliffs at sunset', 'antarctica, iceberg, sea, no clouds',
  'highlands, thick fog, drizzle', 'countryside, summer, huge sun', 'night, half moon, stars, aurora, lake',
]
const SEEDS = [1, 42, 99999, 4294967295]

describe('scene building', () => {
  it('never produces NaN, undefined or Infinity', () => {
    for (const t of SENTENCES) for (const s of SEEDS) {
      const svg = renderSvg(buildScene(parse(t), s), { draw: { seed: s, variant: 1, amp: 2, sketch: true } })
      expect(svg, `${t} / ${s}`).not.toMatch(/NaN|undefined|Infinity|\[object/)
    }
  })
  it('layers come back to front: sky first, paper last, foreground before weather', () => {
    const ids = buildScene(parse('rain over a lake'), 5).map((l) => l.id)
    expect(ids[0]).toBe('sky'); expect(ids.at(-1)).toBe('paper')
    expect(ids.indexOf('foreground')).toBeLessThan(ids.indexOf('rain'))
    expect(ids.indexOf('far')).toBeLessThan(ids.indexOf('terrain-0'))
  })
  it('layer ids are unique so gradients and ids do not clash', () => {
    for (const t of SENTENCES) {
      const ids = buildScene(parse(t), 7).map((l) => l.id)
      expect(new Set(ids).size, t).toBe(ids.length)
    }
  })
  it('weather layers only appear when asked for', () => {
    const calm = buildScene(parse('mountains, no clouds'), 1).map((l) => l.id)
    expect(calm).not.toContain('rain'); expect(calm).not.toContain('snow'); expect(calm).not.toContain('fog')
    const wet = buildScene(parse('heavy rain, thick fog, snowing'), 1).map((l) => l.id)
    expect(wet).toEqual(expect.arrayContaining(['rain', 'fog', 'snow']))
  })
  it('different words give different drawings for the same seed', () => {
    const a = renderSvg(buildScene(parse('desert'), 3)), b = renderSvg(buildScene(parse('arctic'), 3)), c = renderSvg(buildScene(parse('tropical'), 3))
    expect(new Set([a, b, c]).size).toBe(3)
  })
  it('a typed word changes only what it should: unrelated defaults stay put', () => {
    const base = resolveScene(parse('mountains'), 8), more = resolveScene(parse('mountains, a lake'), 8)
    expect(more.time).toBe(base.time); expect(more.weather.clouds).toBe(base.weather.clouds); expect(more.moon).toBe(base.moon)
  })
  it('stays within a sensible size', () => {
    for (const t of SENTENCES) expect(renderSvg(buildScene(parse(t), 3)).length, t).toBeLessThan(140_000)
  })
  it('parse + build + render a 150-character sentence in under 16 ms', () => {
    const t = 'sunset over snowy mountains, a small cabin with a lit window, pine forest, a frozen lake, heavy fog, two boats, no clouds, aurora'
    renderSvg(buildScene(parse(t), 1))
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) renderSvg(buildScene(parse(t), i))
    expect((performance.now() - t0) / 20).toBeLessThan(16)
  })
})

describe('resolve defaults', () => {
  it('empty text still gives a complete pleasant scene', () => {
    const r = resolveScene(emptyScene(), 5)
    expect(r.terrain.length).toBeGreaterThan(0); expect(r.time).toBeTruthy(); expect(r.weather.clouds).toBeGreaterThan(0)
  })
  it('same seed gives the same defaults; different seeds vary', () => {
    expect(resolveScene(emptyScene(), 5).time).toBe(resolveScene(emptyScene(), 5).time)
    const times = new Set(Array.from({ length: 40 }, (_, i) => resolveScene(emptyScene(), i).time))
    expect(times.size).toBeGreaterThan(2)
  })
  it('explicit words always beat defaults', () => {
    for (let s = 0; s < 30; s++) {
      const r = resolveScene(parse('no clouds, no stars, no moon, midday'), s)
      expect(r.weather.clouds).toBe(0); expect(r.stars).toBe(0); expect(r.moon).toBe('none'); expect(r.time).toBe('day')
    }
  })
  it('the sun never shines at night, nor through a storm', () => {
    expect(resolveScene(parse('night, sunny'), 1).sun).toBe(false)
    expect(resolveScene(parse('a storm, sunny'), 1).sun).toBe(false)
  })
  it('night skies get stars and a moon by default', () => {
    const r = resolveScene(parse('night'), 2)
    expect(r.stars).toBeGreaterThan(0.5); expect(r.moon).not.toBe('none')
  })
  it('backdrop follows the most dramatic land form', () => {
    expect(resolveScene(parse('hills and a volcano'), 1).backdrop).toBe('volcano')
    expect(resolveScene(parse('a sea'), 1).backdrop).toMatch(/hills|mountains/)
  })
  it('snow decides the surface', () => {
    expect(resolveScene(parse('snowy hills'), 1).surface).toBe('snow')
    expect(resolveScene(parse('dunes'), 1).surface).toBe('sand')
  })
})

describe('palette', () => {
  it('night is darker than day', () => {
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
    const day = makePalette(resolveScene(parse('midday'), 1)), night = makePalette(resolveScene(parse('midnight'), 1))
    expect(lum(night.sky[0])).toBeLessThan(lum(day.sky[0])); expect(lum(night.lit('#808080'))).toBeLessThan(lum(day.lit('#808080')))
  })
  it('colour words reach the drawing', () => {
    const red = makePalette(resolveScene(parse('midday, red sky'), 1)), plain = makePalette(resolveScene(parse('midday'), 1))
    expect(red.sky[1]).not.toBe(plain.sky[1])
  })
  it('storms grey the sky', () => {
    const g = (hex: string) => { const [r, gg, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]; return Math.max(r, gg, b) - Math.min(r, gg, b) }
    const clear = makePalette(resolveScene(parse('midday, no clouds'), 1)), storm = makePalette(resolveScene(parse('midday, a storm'), 1))
    expect(g(storm.sky[1])).toBeLessThan(g(clear.sky[1]))
  })
})

describe('water geometry', () => {
  it('sea fills below the horizon; land above is dry', () => {
    const r = resolveScene(parse('sea'), 1), g = waterGeometry(r, 1)
    expect(inWater(g, 800, 880)).toBe(true); expect(inWater(g, 800, 300)).toBe(false)
  })
  it('lake centre is water, a far corner is not', () => {
    const r = resolveScene(parse('lake'), 4), g = waterGeometry(r, 4)
    expect(inWater(g, g.lake!.cx, g.lake!.cy)).toBe(true); expect(inWater(g, 5, 5)).toBe(false)
  })
  it('river centre line is water', () => {
    const g = waterGeometry(resolveScene(parse('river'), 4), 4)
    const p = g.river!.pts[10]!
    expect(inWater(g, p.x, p.y)).toBe(true)
  })
  it('no water mentioned means no water', () => {
    const g = waterGeometry(resolveScene(parse('dunes'), 4), 4)
    expect(g.sea ?? g.lake ?? g.river).toBeUndefined()
  })
})
