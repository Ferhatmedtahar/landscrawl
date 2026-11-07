import { describe, expect, it } from 'vitest'
import { drawLayer, inkOf, type DrawOptions } from '../src/render/draw'
import { flatten, jitterPolys, polysToD } from '../src/render/jitter'
import { AMP_ACTIVE, AMP_SETTLED, SETTLE_MS, VARIANTS, ampFor, diffLayers, nextVariant, parallax } from '../src/render/motion'
import { cropFor, renderSvg } from '../src/render/svgRenderer'
import { parse } from '../src/parser/parse'
import { buildScene } from '../src/scene/buildScene'
import { VIEW } from '../src/scene/types'

const sketch = (variant: number, amp = 2): DrawOptions => ({ seed: 5, variant, amp, sketch: true })
const scene = () => buildScene(parse('sunset over snowy mountains, a lake, pine forest, clouds'), 5)

describe('path flattening', () => {
  it('turns a square into a closed polygon with straight edges', () => {
    const [p] = flatten('M0 0L100 0L100 100L0 100Z', 20)
    expect(p!.closed).toBe(true)
    expect(p!.pts[0]).toEqual([0, 0]); expect(p!.pts.at(-1)).toEqual([0, 100])
    expect(p!.pts.length).toBeGreaterThan(15) // long edges are subdivided
  })
  it('handles relative commands, H and V', () => {
    const [p] = flatten('M10 10h20v20l-20 0z', 100)
    expect(p!.pts.map(([x, y]) => `${x},${y}`)).toEqual(['10,10', '30,10', '30,30', '10,30'])
  })
  it('flattens cubic and quadratic curves ending exactly on their end point', () => {
    const [c] = flatten('M0 0C0 50 100 50 100 0', 10), [q] = flatten('M0 0q50 50 100 0', 10)
    expect(c!.pts.at(-1)).toEqual([100, 0]); expect(q!.pts.at(-1)).toEqual([100, 0])
    expect(Math.max(...c!.pts.map((p) => p[1]))).toBeGreaterThan(30)
  })
  it('flattens arcs: a circle stays on its circle', () => {
    const [p] = flatten('M-50 0A50 50 0 1 0 50 0A50 50 0 1 0 -50 0Z', 10)
    for (const [x, y] of p!.pts) expect(Math.hypot(x, y)).toBeCloseTo(50, 0)
    expect(p!.pts.length).toBeGreaterThan(12)
  })
  it('keeps several subpaths apart', () => {
    expect(flatten('M0 0L10 0M20 20L30 20')).toHaveLength(2)
  })
  it('survives garbage', () => {
    expect(() => flatten('')).not.toThrow(); expect(() => flatten('M L Z 12 x')).not.toThrow()
  })
})

describe('jitter', () => {
  const polys = flatten('M0 0L400 0L400 400L0 400Z', 16)
  it('is deterministic per seed and differs between seeds', () => {
    expect(polysToD(jitterPolys(polys, 1, 2))).toBe(polysToD(jitterPolys(polys, 1, 2)))
    expect(polysToD(jitterPolys(polys, 1, 2))).not.toBe(polysToD(jitterPolys(polys, 2, 2)))
  })
  it('amplitude 0 leaves the geometry alone', () => {
    const j = jitterPolys(polys, 3, 0)
    j[0]!.pts.forEach((p, i) => { expect(p[0]).toBeCloseTo(polys[0]!.pts[i]![0], 6); expect(p[1]).toBeCloseTo(polys[0]!.pts[i]![1], 6) })
  })
  it('keeps every point within the amplitude (plus shake)', () => {
    const amp = 2
    jitterPolys(polys, 9, amp)[0]!.pts.forEach((p, i) => {
      expect(Math.hypot(p[0] - polys[0]!.pts[i]![0], p[1] - polys[0]!.pts[i]![1])).toBeLessThan(amp * 1.7)
    })
  })
  it('wobbles coherently: neighbouring points move alike', () => {
    const j = jitterPolys(flatten('M0 0L160 0', 4), 4, 3)[0]!.pts
    for (let i = 1; i < j.length; i++) expect(Math.abs(j[i]![1] - j[i - 1]![1])).toBeLessThan(2)
  })
})

describe('sketch drawing', () => {
  it('opaque fills get a double outline; translucent shadows get hatching instead', () => {
    const items = scene().flatMap((l) => drawLayer(l, sketch(0)))
    expect(items.filter((i) => i.kind === 'ink').length).toBeGreaterThan(10)
    expect(items.filter((i) => i.kind === 'hatch').length).toBeGreaterThan(0)
    const terrain = scene().find((l) => l.id === 'terrain-0')!
    const kinds = drawLayer(terrain, sketch(0)).map((i) => i.kind)
    expect(kinds.indexOf('ink')).toBeGreaterThan(kinds.indexOf('fill'))
  })
  it('structure is identical across boil variants, only coordinates differ', () => {
    for (const layer of scene()) {
      const a = drawLayer(layer, sketch(0)), b = drawLayer(layer, sketch(1))
      expect(a.map((i) => i.kind)).toEqual(b.map((i) => i.kind))
    }
    const t = scene().find((l) => l.id === 'terrain-1')!
    expect(drawLayer(t, sketch(0))[0]!.d).not.toBe(drawLayer(t, sketch(1))[0]!.d)
  })
  it('still elements and pure gradients are never jittered', () => {
    const sky = scene().find((l) => l.id === 'sky')!
    expect(drawLayer(sky, sketch(0))[0]!.d).toBe(sky.paths[0]!.d)
    expect(drawLayer(sky, sketch(0)).some((i) => i.kind === 'ink')).toBe(false)
  })
  it('plain options reproduce the exact geometry with no outlines', () => {
    const svg = renderSvg(scene())
    expect(svg).not.toContain('stroke-width="1.7"'); expect(svg).toContain('M-64')
  })
  it('sketch rendering is byte-identical for the same options', () => {
    const o = { draw: sketch(2) }
    expect(renderSvg(scene(), o)).toBe(renderSvg(scene(), o))
    expect(renderSvg(scene(), o)).not.toBe(renderSvg(scene(), { draw: sketch(3) }))
  })
  it('a smaller amplitude moves lines less', () => {
    const exact = flatten(scene().find((l) => l.id === 'terrain-1')!.paths[0]!.d)
    const dist = (amp: number) => {
      const pts = jitterPolys(exact, 11, amp)[0]!.pts, base = exact[0]!.pts
      return pts.reduce((s, p, i) => s + Math.hypot(p[0] - base[i]![0], p[1] - base[i]![1]), 0) / pts.length
    }
    expect(dist(AMP_SETTLED)).toBeLessThan(dist(AMP_ACTIVE))
  })
  it('ink is darker than its fill', () => {
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16)
    expect(lum(inkOf('#88aa66'))).toBeLessThan(lum('#88aa66'))
  })
})

describe('motion helpers', () => {
  it('jitter settles after 600 ms without typing', () => {
    expect(ampFor(0)).toBe(AMP_ACTIVE); expect(ampFor(SETTLE_MS - 1)).toBe(AMP_ACTIVE); expect(ampFor(SETTLE_MS)).toBe(AMP_SETTLED)
  })
  it('boil cycles through all variants', () => {
    let v = 0; const seen = new Set<number>()
    for (let i = 0; i < VARIANTS; i++) { seen.add(v); v = nextVariant(v) }
    expect(seen.size).toBe(VARIANTS); expect(v).toBe(0)
  })
  it('diffs layers into added, removed and kept', () => {
    expect(diffLayers(['sky', 'sea', 'rain'], ['sky', 'lake', 'sea'])).toEqual({ added: ['lake'], removed: ['rain'], kept: ['sky', 'sea'] })
  })
  it('near layers move more than far ones; sky does not move', () => {
    expect(Math.abs(parallax(1, 1, 0).x)).toBeGreaterThan(Math.abs(parallax(0.25, 1, 0).x))
    expect(parallax(0, 1, 1)).toEqual({ x: -0, y: -0 })
  })
  it('crops for other aspect ratios keep the full height and stay centred', () => {
    expect(cropFor('16:9')).toEqual({ x: 0, y: 0, w: VIEW.w, h: VIEW.h })
    const sq = cropFor('1:1'); expect(sq.w).toBe(VIEW.h); expect(sq.x).toBe((VIEW.w - VIEW.h) / 2)
    expect(cropFor('9:16').w / cropFor('9:16').h).toBeCloseTo(9 / 16)
  })
})
