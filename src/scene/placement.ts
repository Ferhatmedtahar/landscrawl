import { mulberry32, subSeed, type Rng } from '../render/prng'
import { cliffGeometry, inWater, type Profile, type Pt, type WaterGeo } from './geometry'
import { makeNoise1D } from './noise'
import type { Resolved } from './resolve'
import { VIEW, type SceneObject } from './types'

export type TreeKind = 'pine' | 'leaf' | 'palm' | 'dead' | 'cactus'
export interface PlacedTree { kind: TreeKind; x: number; y: number; s: number; seed: number; lone: boolean }
export interface PlacedObject { kind: SceneObject; x: number; y: number; s: number; seed: number; x2?: number; onIslet?: boolean }
export interface Box { x0: number; y0: number; x1: number; y1: number }

export interface Firefly { x: number; y: number; r: number }

export interface Scenery {
  objects: PlacedObject[]
  /** Hovering lights over dry land. */
  fireflies: Firefly[]
  trees: PlacedTree[]
  /** Centre line of the road, near to far, with half-widths. */
  road?: { x: number; y: number; hw: number }[]
  /** Everything that was asked for but had nowhere to go. */
  skipped: SceneObject[]
}

/** Perspective: things lower on the screen are nearer and larger. */
export const scaleAt = (y: number) => Math.min(1.3, Math.max(0.38, 0.4 + ((y - 610) / 270) * 0.9))

const KIND_SIZE: Partial<Record<SceneObject, number>> = { cabin: 1.35, house: 1.25, village: 1.5, tent: 1.35, campfire: 1.4, balloon: 1.1, pyramid: 2.4, lighthouse: 1.5, windmill: 1.5, mosque: 1.3, casbah: 1.4, camel: 1.5, penguins: 1.6, boat: 1.2, whale: 1.4, castle: 1.3, igloo: 1.7, ruins: 1.3, sled: 1.5 }
/** Half-width of each thing at scale 1, for overlap checks. */
const HALF_W: Partial<Record<SceneObject, number>> = { cabin: 55, house: 62, village: 120, boat: 50, tent: 48, campfire: 22, windmill: 45, castle: 90, casbah: 100, mosque: 70, camel: 50, igloo: 55, pyramid: 100, ruins: 80, sled: 40, penguins: 50, lighthouse: 26, whale: 90 }
const HEIGHT: Partial<Record<SceneObject, number>> = { cabin: 80, house: 95, village: 100, boat: 90, tent: 60, campfire: 40, windmill: 130, castle: 140, casbah: 90, mosque: 140, camel: 80, igloo: 60, pyramid: 100, ruins: 90, sled: 40, penguins: 50, lighthouse: 150, whale: 60 }

export interface Ground {
  /** True when (x, y) is dry land you could stand a house on. */
  land(x: number, y: number): boolean
  shore: Profile
}

export function makeGround(r: Resolved, seed: number, water: WaterGeo, shore: Profile): Ground {
  const cliff = r.cliffs ? cliffGeometry(seed) : undefined
  const onCliff = (x: number) => (cliff ? (cliff.side === 0 ? x < cliff.w + 20 : x > VIEW.w - cliff.w - 20) : false)
  return {
    shore,
    land(x, y) {
      if (x < 40 || x > VIEW.w - 40 || y < 624 || y > 890) return false
      if (onCliff(x)) return false
      if (water.sea) return y > shore(x) + 14
      return !inWater(water, x, y)
    },
  }
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

function footprint(kind: SceneObject, x: number, y: number, s: number): Box {
  const hw = (HALF_W[kind] ?? 40) * s, h = (HEIGHT[kind] ?? 60) * s
  return { x0: x - hw, x1: x + hw, y0: y - h, y1: y + 8 * s }
}

interface SpotSpec { kind: SceneObject; yMin: number; yMax: number; ok(x: number, y: number, hw: number): boolean }

function findSpot(rng: Rng, spec: SpotSpec, taken: Box[], scale: number, tries = 90): { x: number; y: number; s: number } | undefined {
  for (let i = 0; i < tries; i++) {
    const x = 120 + rng() * (VIEW.w - 240), y = spec.yMin + rng() * (spec.yMax - spec.yMin)
    const s = scaleAt(y) * (KIND_SIZE[spec.kind] ?? 1) * scale
    const hw = (HALF_W[spec.kind] ?? 40) * s
    if (!spec.ok(x, y, hw)) continue
    const box = footprint(spec.kind, x, y, s)
    if (taken.some((t) => overlaps(t, box))) continue
    return { x, y, s }
  }
  return undefined
}

const SKY_OBJECTS: ReadonlySet<SceneObject> = new Set(['birds'])
const WATER_OBJECTS: ReadonlySet<SceneObject> = new Set(['boat', 'whale'])

/** Decide where everything stands. Pure: same scene and seed give the same placement. */
export function placeScenery(r: Resolved, seed: number, water: WaterGeo, ground: Ground): Scenery {
  const out: Scenery = { objects: [], fireflies: [], trees: [], skipped: [] }
  const taken: Box[] = []
  const landOk = (x: number, y: number, hw: number) => ground.land(x - hw, y) && ground.land(x, y) && ground.land(x + hw, y) && ground.land(x, y - 6)
  const waterOk = (x: number, y: number, hw: number) => {
    const edge = (xx: number) => inWater(water, xx, y) && (!water.sea || y < ground.shore(xx) - 8)
    return edge(x - hw) && edge(x + hw) && edge(x) && inWater(water, x, y + 8) && inWater(water, x, y - 10)
  }
  const has = (k: SceneObject) => r.objects.find((o) => o.kind === k)

  // ---- road first: trees and houses keep clear of it
  const roadObj = has('road')
  if (roadObj) {
    const rng = mulberry32(subSeed(seed, 'road'))
    for (let attempt = 0; attempt < 12 && !out.road; attempt++) {
      const x0 = 300 + rng() * 1000, xe = 500 + rng() * 600, ph = rng() * 6, amp = 40 + rng() * 90
      const pts: { x: number; y: number; hw: number }[] = []
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, y = 905 - t * (905 - 630)
        pts.push({ x: x0 + (xe - x0) * t + Math.sin(t * 4 + ph) * amp * (1 - t), y, hw: (4 + (1 - t) * (1 - t) * 70) * roadObj.scale })
      }
      if (pts.slice(0, 13).every((p) => p.y > 880 || ground.land(p.x, p.y))) out.road = pts
    }
    if (!out.road) out.skipped.push('road')
  }
  const onRoad = (x: number, y: number, pad: number) => !!out.road?.some((p) => Math.abs(p.y - y) < 24 && Math.abs(p.x - x) < p.hw + pad)
  if (out.road) for (let i = 0; i < out.road.length - 1; i++) {
    const a = out.road[i]!, b = out.road[i + 1]!
    taken.push({ x0: Math.min(a.x, b.x) - a.hw, x1: Math.max(a.x, b.x) + a.hw, y0: b.y, y1: a.y })
  }

  // ---- objects
  for (const o of r.objects) {
    if (o.kind === 'road') continue
    const rng = mulberry32(subSeed(seed, `obj:${o.kind}`))
    if (o.kind === 'balloon') {
      // one slot per balloon, so they never stack; each floats well inside the frame
      for (let i = 0; i < o.count; i++) {
        const s = (0.85 + rng() * 0.4) * 1.1 * o.scale
        const x = 200 + ((i + 0.15 + rng() * 0.7) / o.count) * 1200
        const y = Math.max(250 + rng() * 120, 140 * s + 10)
        out.objects.push({ kind: 'balloon', x, y, s, seed: Math.floor(rng() * 1e9) })
      }
      continue
    }
    if (SKY_OBJECTS.has(o.kind)) {
      const cx = 300 + rng() * 1000, cy = 170 + rng() * 170
      for (let i = 0; i < o.count; i++) out.objects.push({ kind: o.kind, x: cx + (rng() - 0.5) * 260, y: cy + (rng() - 0.5) * 90, s: (0.8 + rng() * 0.6) * o.scale, seed: Math.floor(rng() * 1e9) })
      continue
    }
    if (o.kind === 'bridge') {
      if (water.river) {
        const p = water.river.pts[Math.round(water.river.pts.length * 0.55)]!
        out.objects.push({ kind: 'bridge', x: p.x, y: p.y, x2: p.x + 0, s: scaleAt(p.y) * o.scale, seed: Math.round(p.w) })
      } else if (water.lake) {
        const l = water.lake, y = l.cy + l.ry * 0.45, half = l.rx * Math.sqrt(1 - 0.45 * 0.45)
        out.objects.push({ kind: 'bridge', x: l.cx - half, x2: l.cx + half, y, s: scaleAt(y) * o.scale, seed: 1 })
      } else if (water.sea) {
        const x = 300 + rng() * 1000, y = ground.shore(x) + 4
        out.objects.push({ kind: 'bridge', x, x2: x, y, s: scaleAt(y) * o.scale, seed: 2 })
      } else out.skipped.push('bridge')
      continue
    }
    if (o.kind === 'lighthouse') {
      const cliff = r.cliffs ? cliffGeometry(seed) : undefined
      if (cliff) {
        const x = cliff.side === 0 ? cliff.w * 0.35 : VIEW.w - cliff.w * 0.35
        out.objects.push({ kind: 'lighthouse', x, y: cliff.top + 18, s: 0.95 * o.scale, seed: 1 })
      } else if (water.sea) {
        const x = 250 + rng() * 1100, y = water.sea.top + 50 + rng() * 60
        out.objects.push({ kind: 'lighthouse', x, y, s: scaleAt(y) * 1.2 * o.scale, seed: 1, onIslet: true })
      } else {
        const spot = findSpot(rng, { kind: 'lighthouse', yMin: 640, yMax: 760, ok: (x, y, hw) => landOk(x, y, hw) && !onRoad(x, y, hw) }, taken, o.scale)
        if (spot) out.objects.push({ kind: 'lighthouse', ...spot, seed: 1 }); else out.skipped.push('lighthouse')
      }
      const last = out.objects.at(-1)
      if (last?.kind === 'lighthouse') taken.push(footprint('lighthouse', last.x, last.y, last.s))
      continue
    }
    const isWater = WATER_OBJECTS.has(o.kind)
    if (isWater && !(water.sea || water.lake || water.river)) { out.skipped.push(o.kind); continue }
    if (o.kind === 'whale' && !water.sea) { out.skipped.push('whale'); continue }
    let placed = 0
    for (let i = 0; i < o.count; i++) {
      const spec: SpotSpec = isWater
        ? { kind: o.kind, yMin: water.sea ? water.sea.top + 40 : 640, yMax: water.sea ? 780 : 800, ok: waterOk }
        : { kind: o.kind, yMin: o.kind === 'pyramid' || o.kind === 'castle' ? 628 : 640, yMax: water.sea ? 890 : o.kind === 'pyramid' || o.kind === 'castle' ? 700 : 800, ok: (x, y, hw) => landOk(x, y, hw) && !onRoad(x, y, hw) }
      const spot = findSpot(rng, spec, taken, o.scale)
      if (!spot) continue
      const placedObj: PlacedObject = { kind: o.kind, ...spot, seed: Math.floor(rng() * 1e9) }
      out.objects.push(placedObj)
      taken.push(footprint(o.kind, spot.x, spot.y, spot.s))
      placed++
    }
    if (placed === 0) out.skipped.push(o.kind)
  }

  // ---- fireflies: small lights hovering over dry land
  if (r.fireflies) {
    const rngF = mulberry32(subSeed(seed, 'fireflies'))
    for (let tries = 0; tries < 600 && out.fireflies.length < 46; tries++) {
      const x = 60 + rngF() * (VIEW.w - 120), y = 640 + rngF() * 230, rad = 1.8 + rngF() * 2
      if (ground.land(x, y)) out.fireflies.push({ x, y, r: rad })
    }
  }

  // ---- plants: patches of the main kinds, never on water, the road or a building
  const v = r.vegetation
  const rngT = mulberry32(subSeed(seed, 'trees'))
  const clumpNoise = makeNoise1D(subSeed(seed, 'clumps'), 3)
  const clear = (x: number, y: number, s: number) =>
    ground.land(x, y) && ground.land(x - 14 * s, y) && ground.land(x + 14 * s, y) && !onRoad(x, y, 24 * s) && !taken.some((t) => x > t.x0 - 6 && x < t.x1 + 6 && y > t.y0 + (t.y1 - t.y0) * 0.45 && y < t.y1 + 10)
  const sow = (kind: TreeKind, count: number, spread: number) => {
    const placed: PlacedTree[] = []
    let guard = 0
    while (placed.length < count && guard++ < count * 40) {
      const x = 60 + rngT() * (VIEW.w - 120), y = 632 + rngT() * 250
      if (spread > 0 && clumpNoise(x * 0.004 + (kind === 'pine' ? 9 : 0)) < -0.1 + (1 - spread) * 0.5) continue
      const s = scaleAt(y) * (0.85 + rngT() * 0.3)
      if (!clear(x, y, s)) continue
      if (out.trees.concat(placed).some((t) => Math.abs(t.x - x) < 26 * Math.max(s, t.s) && Math.abs(t.y - y) < 12 * Math.max(s, t.s))) continue
      placed.push({ kind, x, y, s, seed: Math.floor(rngT() * 1e9), lone: false })
    }
    out.trees.push(...placed)
  }
  const snowy = r.snowCover >= 0.6
  sow('pine', Math.round(v.pine * 48), 0.7)
  sow(snowy ? 'dead' : 'leaf', Math.round(v.forest * 48), 0.7)
  sow('palm', Math.round(v.palm * 18), 0.4)
  sow('cactus', Math.round(v.cactus * 14), 0.2)
  sow('dead', Math.round(v.deadTrees * 16), 0.3)
  if (v.loneTree) {
    const kind: TreeKind = v.palm > 0 ? 'palm' : v.pine > 0 ? 'pine' : v.cactus > 0 ? 'cactus' : snowy ? 'dead' : 'leaf'
    for (let tries = 0; tries < 80; tries++) {
      const x = 300 + rngT() * 1000, y = 680 + rngT() * 120, s = scaleAt(y) * 1.7
      if (!clear(x, y, s * 1.4)) continue
      out.trees.push({ kind, x, y, s, seed: Math.floor(rngT() * 1e9), lone: true })
      break
    }
  }
  out.trees.sort((a, b) => a.y - b.y)
  return out
}

export type { Pt }
