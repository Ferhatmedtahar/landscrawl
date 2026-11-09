import { describe, expect, it } from 'vitest'
import { parse } from '../src/modules/parser/parse'
import { buildScene } from '../src/modules/scene/buildScene'
import { HORIZON, inWater, waterGeometry } from '../src/modules/scene/layout/geometry'
import { shoreProfile } from '../src/modules/scene/layers/ground'
import { makeGround, placeScenery } from '../src/modules/scene/layout/placement'
import { resolveScene } from '../src/modules/scene/model/resolve'

function place(text: string, seed: number) {
  const r = resolveScene(parse(text), seed)
  const water = waterGeometry(r, seed)
  const ground = makeGround(r, seed, water, shoreProfile(r, seed, water))
  return { r, water, ground, s: placeScenery(r, seed, water, ground) }
}
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3)

describe('placement rules', () => {
  it('boats are only ever on water', () => {
    let boats = 0
    for (const seed of SEEDS) for (const t of ['a lake with two boats', 'sea, a boat', 'river and a boat', 'a lake, a boat, a village']) {
      const { water, s } = place(t, seed)
      for (const o of s.objects.filter((o) => o.kind === 'boat')) { boats++; expect(inWater(water, o.x, o.y), `${t} @${seed}`).toBe(true) }
    }
    expect(boats).toBeGreaterThan(40)
  })
  it('cabins, houses and tents are never in water', () => {
    let n = 0
    for (const seed of SEEDS) for (const t of ['lake, a cabin, a house, a tent', 'river, village, cabin', 'sea, beach, a house, a tent']) {
      const { ground, s } = place(t, seed)
      for (const o of s.objects.filter((o) => ['cabin', 'house', 'tent', 'village'].includes(o.kind))) { n++; expect(ground.land(o.x, o.y), `${t} @${seed}`).toBe(true) }
    }
    expect(n).toBeGreaterThan(60)
  })
  it('trees never stand in water, on the road or on a building', () => {
    for (const seed of SEEDS) {
      const { water, ground, s } = place('forest, lake, river, a cabin, a road, pine forest', seed)
      expect(s.trees.length).toBeGreaterThan(5)
      for (const t of s.trees) {
        expect(inWater(water, t.x, t.y)).toBe(false); expect(ground.land(t.x, t.y)).toBe(true)
        for (const p of s.road ?? []) if (Math.abs(p.y - t.y) < 10) expect(Math.abs(p.x - t.x)).toBeGreaterThan(p.hw)
      }
    }
  })
  it('the road stays on land', () => {
    for (const seed of SEEDS) {
      const { ground, s } = place('lake, a road, hills', seed)
      for (const p of s.road ?? []) if (p.y < 880) expect(ground.land(p.x, p.y)).toBe(true)
    }
  })
  it('things that need water are skipped when there is none, never placed on land', () => {
    expect(place('dunes, a whale', 1).s.skipped).toContain('whale')
    expect(place('a boat on dry hills', 1).s.skipped).toContain('boat')
    expect(place('dunes, a whale', 1).s.objects.some((o) => o.kind === 'whale')).toBe(false)
  })
  it('a whale swims only in the sea', () => {
    for (const seed of SEEDS) { const { water, s } = place('sea, a whale', seed); for (const o of s.objects.filter((o) => o.kind === 'whale')) expect(inWater(water, o.x, o.y)).toBe(true) }
  })
  it('objects do not overlap each other', () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const { s } = place('village, cabin, tent, campfire, windmill, camel, camel', seed)
      for (let i = 0; i < s.objects.length; i++) for (let j = i + 1; j < s.objects.length; j++) {
        const a = s.objects[i]!, b = s.objects[j]!
        expect(a.x === b.x && a.y === b.y, `${a.kind}/${b.kind} stacked`).toBe(false)
      }
    }
  })
  it('counts are honoured when there is room', () => {
    const boats = SEEDS.map((seed) => place('a big lake, two boats', seed).s.objects.filter((o) => o.kind === 'boat').length)
    expect(boats.filter((n) => n === 2).length).toBeGreaterThan(SEEDS.length / 2)
  })
  it('a lone tree is one big tree', () => {
    const { s } = place('a lone palm, dunes', 5)
    const lone = s.trees.filter((t) => t.lone)
    expect(lone).toHaveLength(1); expect(lone[0]!.kind).toBe('palm')
  })
  it('lighthouses stand on a cliff, an islet or land, never floating on open water without a rock', () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const { r, s } = place('sea, a lighthouse', seed)
      for (const o of s.objects.filter((o) => o.kind === 'lighthouse')) expect(r.cliffs || o.onIslet).toBe(true)
    }
  })
  it('placement is deterministic and varies with the seed', () => {
    expect(JSON.stringify(place('forest, village, lake', 9).s)).toBe(JSON.stringify(place('forest, village, lake', 9).s))
    expect(JSON.stringify(place('forest, village, lake', 9).s)).not.toBe(JSON.stringify(place('forest, village, lake', 10).s))
  })
  it('birds fly in the sky', () => {
    for (const o of place('birds', 4).s.objects) expect(o.y).toBeLessThan(400)
  })
})

describe('balloons and fireflies', () => {
  it('a hot air balloon floats in the sky, fully inside the picture', () => {
    for (const seed of SEEDS) for (const o of place('hot air balloon', seed).s.objects) {
      expect(o.kind).toBe('balloon'); expect(o.y).toBeLessThan(420); expect(o.y - 130 * o.s).toBeGreaterThan(0); expect(o.x).toBeGreaterThan(60); expect(o.x).toBeLessThan(1540)
    }
  })
  it('several balloons do not sit on top of each other', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const xs = place('three balloons', seed).s.objects.filter((o) => o.kind === 'balloon').map((o) => o.x).sort((a, b) => a - b)
      expect(xs.length).toBe(3)
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(100)
    }
  })
  it('fireflies hover over land, never over water', () => {
    let n = 0
    for (const seed of SEEDS) {
      const { ground, s } = place('night, fireflies, lake, river, forest', seed)
      for (const f of s.fireflies) { n++; expect(ground.land(f.x, f.y), `@${seed}`).toBe(true) }
    }
    expect(n).toBeGreaterThan(200)
  })
  it('fireflies show at night and dusk, and by default pick a dark time of day', () => {
    const ids = (t: string, seed = 5) => buildScene(parse(t), seed).map((l) => l.id)
    expect(ids('night, fireflies')).toContain('fireflies')
    expect(ids('midday, fireflies')).not.toContain('fireflies')
    expect(ids('night, forest')).not.toContain('fireflies')
    for (const seed of SEEDS.slice(0, 20)) expect(['dusk', 'night']).toContain(resolveScene(parse('fireflies'), seed).time)
  })
  it('a rainbow adds one arc per colour to the sky layer, fainter at night', () => {
    const sky = (t: string) => buildScene(parse(t), 5).find((l) => l.id === 'celestial')!
    const sunny = sky('midday, rainbow'), plain = sky('midday')
    expect(sunny.paths.length - plain.paths.length).toBe(7)
    const op = (l: ReturnType<typeof sky>) => Math.max(...l.paths.slice(-7).map((p) => p.opacity ?? 1))
    expect(op(sky('night, rainbow'))).toBeLessThan(op(sunny))
  })
  it('rainbow arcs are nested, stand on the ground line and peak inside the picture', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const arcs = buildScene(parse('rainbow'), seed).find((l) => l.id === 'celestial')!.paths.slice(-7)
      let prevRadius = Infinity
      for (const p of arcs) {
        const m = /^M(-?[\d.]+) (-?[\d.]+)A([\d.]+) ([\d.]+) 0 0 1 (-?[\d.]+) (-?[\d.]+)$/.exec(p.d)
        expect(m, p.d).not.toBeNull()
        const [, , y0, rx, , , y1] = m!.map(Number) as number[]
        expect(y0).toBe(y1); expect(y0).toBeGreaterThanOrEqual(HORIZON); expect(y0! - rx!).toBeGreaterThan(0)
        expect(rx!).toBeLessThan(prevRadius); prevRadius = rx!
      }
    }
  })
  it('the accessible description mentions them', async () => {
    const { describeScene } = await import('../src/modules/ui/describe')
    expect(describeScene(resolveScene(parse('rainbow, a hot air balloon, night, fireflies'), 3))).toMatch(/rainbow.*|balloon/)
    expect(describeScene(resolveScene(parse('rainbow'), 3))).toContain('a rainbow')
    expect(describeScene(resolveScene(parse('night, fireflies'), 3))).toContain('fireflies')
  })
})

describe('scenery layers and night glow', () => {
  const ids = (t: string, seed = 5) => buildScene(parse(t), seed).map((l) => l.id)
  it('vegetation and objects layers appear when there is something to draw', () => {
    expect(ids('pine forest, a cabin')).toEqual(expect.arrayContaining(['vegetation', 'objects']))
  })
  it('glow appears for lit things at night but not at midday', () => {
    expect(ids('night, a cabin with a lit window')).toContain('glow')
    expect(ids('midday, a cabin with a lit window')).not.toContain('glow')
    expect(ids('night, a campfire')).toContain('glow')
    expect(ids('dusk, sea, a lighthouse')).toContain('glow')
  })
  it('no lit window flag means no window glow', () => {
    expect(ids('night, a cabin, no fire')).not.toContain('glow')
  })
  it('the glow sits above the objects', () => {
    const l = ids('night, a campfire')
    expect(l.indexOf('glow')).toBeGreaterThan(l.indexOf('objects'))
  })
  it('the road is drawn before the plants and buildings', () => {
    const l = ids('a road, forest, a cabin')
    expect(l.indexOf('road')).toBeLessThan(l.indexOf('vegetation'))
  })
  it('every object the parser knows can be drawn without error', () => {
    const all = 'cabin house village boat road bridge lighthouse tent campfire windmill birds balloon castle casbah mosque camel igloo pyramid ruins sled penguins whale'
    for (const kind of all.split(' ')) for (const seed of [1, 2, 3]) {
      expect(() => buildScene(parse(`sea, lake, river, ${kind}`), seed), kind).not.toThrow()
      expect(() => buildScene(parse(`night, dunes, ${kind}`), seed), kind).not.toThrow()
    }
  })
})
