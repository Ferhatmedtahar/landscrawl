import { mulberry32, subSeed } from '../../render/prng'
import { f1, HORIZON, inWater, polyline, smoothClosed, type Pt, type WaterGeo } from '../geometry'
import { mix, shade } from '../color'
import type { Pal } from '../palette'
import type { Resolved } from '../resolve'
import { VIEW, type Layer, type PathSpec } from '../types'
import { skyBodies } from './celestial'

function ripples(geo: WaterGeo, r: Resolved, pal: Pal, seed: number): PathSpec[] {
  const rng = mulberry32(subSeed(seed, 'ripples'))
  let a = '', b = ''
  const top = geo.sea ? geo.sea.top : geo.lake ? geo.lake.cy - geo.lake.ry : HORIZON
  const bottom = geo.sea ? VIEW.h : geo.lake ? geo.lake.cy + geo.lake.ry : VIEW.h
  const rows = geo.sea ? 26 : 12
  for (let k = 0; k < rows; k++) {
    const t = (k + 0.5) / rows
    const y = top + Math.pow(t, 1.6) * (bottom - top)
    const per = 5 + Math.floor(t * 9)
    for (let i = 0; i < per; i++) {
      const x = rng() * VIEW.w
      if (!inWater(geo, x, y)) continue
      const len = (24 + rng() * 80) * (0.4 + t)
      const seg = `M${f1(x)} ${f1(y)}q${f1(len / 2)} ${f1(-2 - t * 5)} ${f1(len)} 0`
      if (rng() < 0.5) a += seg
      else b += seg
    }
  }
  const spec: PathSpec[] = []
  if (a) spec.push({ d: a, stroke: pal.water.line, strokeWidth: 2.2, opacity: 0.7 })
  if (b) spec.push({ d: b, stroke: shade(pal.water.bottom, 0.8), strokeWidth: 2, opacity: 0.45 })
  return spec
}

/** A glittering column under the sun or moon. */
function glitter(geo: WaterGeo, r: Resolved, seed: number): PathSpec[] {
  const bodies = skyBodies(r)
  const body = r.sun && r.time !== 'dusk' ? { ...bodies.sun, color: '#fff1c0', up: true } : r.moon !== 'none' ? { ...bodies.moon, color: '#e8ecff', up: r.time === 'night' } : undefined
  if (!body || !body.up) return []
  const rng = mulberry32(subSeed(seed, 'glitter'))
  const top = geo.sea ? geo.sea.top : geo.lake ? geo.lake.cy - geo.lake.ry * 0.8 : undefined
  if (top === undefined) return []
  const bottom = geo.sea ? VIEW.h - 30 : (geo.lake as NonNullable<WaterGeo['lake']>).cy + (geo.lake as NonNullable<WaterGeo['lake']>).ry * 0.8
  let d = ''
  const strength = r.reflection ? 1 : 0.7
  for (let i = 0; i < 16; i++) {
    const t = i / 15
    const y = top + 10 + t * (bottom - top - 10)
    if (!inWater(geo, body.x, y)) continue
    const w = (14 + t * 90) * (0.5 + rng() * 0.8) * strength
    const x = body.x + (rng() - 0.5) * 40 * (0.4 + t)
    d += `M${f1(x - w / 2)} ${f1(y)}h${f1(w)}`
  }
  return d ? [{ d, stroke: body.color, strokeWidth: 3.2, opacity: 0.75 * (1 - r.weather.clouds * 0.4) }] : []
}

function icebergs(geo: WaterGeo, r: Resolved, pal: Pal, seed: number): PathSpec[] {
  if (!r.iceberg || !geo.sea) return []
  const rng = mulberry32(subSeed(seed, 'icebergs'))
  const out: PathSpec[] = []
  const n = 1 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    const cx = 200 + rng() * 1200, wl = geo.sea.top + 34 + rng() * 110 + i * 20
    const w = 110 + rng() * 150, h = 60 + rng() * 90
    const body: Pt[] = [[cx - w / 2, wl], [cx - w * 0.38, wl - h * 0.45], [cx - w * 0.2, wl - h * 0.55], [cx - w * 0.05, wl - h], [cx + w * 0.12, wl - h * 0.62], [cx + w * 0.3, wl - h * 0.72], [cx + w / 2, wl]]
    const ice = pal.lit('#e6f1f8', 0.05)
    out.push({ d: polyline(body.map(([x, y]) => [x, 2 * wl - y + h * 0.35] as Pt), true), fill: mix(pal.water.bottom, '#9fd4e8', 0.4), opacity: 0.45 })
    out.push({ d: polyline(body, true), fill: ice })
    out.push({ d: polyline([body[3] as Pt, body[4] as Pt, body[5] as Pt, body[6] as Pt, [cx + w * 0.05, wl]], true), fill: shade(ice, 0.8), opacity: 0.75 })
  }
  return out
}

export function waterLayers(r: Resolved, pal: Pal, seed: number, geo: WaterGeo): Layer[] {
  const layers: Layer[] = []
  const { top, bottom } = pal.water
  if (geo.sea) {
    layers.push({
      id: 'sea', depth: 0.5,
      defs: `<linearGradient id="sea-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`,
      paths: [
        { d: `M0 ${geo.sea.top}H${VIEW.w}V${VIEW.h}H0Z`, fill: 'url(#sea-grad)' },
        ...ripples(geo, r, pal, seed), ...glitter(geo, r, seed), ...icebergs(geo, r, pal, seed),
      ],
    })
  }
  if (geo.lake) {
    const l = geo.lake
    const bank: Pt[] = l.pts.map(([x, y]) => [l.cx + (x - l.cx) * 1.05, l.cy + (y - l.cy) * 1.12 + 3] as Pt)
    layers.push({
      id: 'lake', depth: 0.6,
      defs: `<linearGradient id="lake-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${mix(top, bottom, 0.8)}"/></linearGradient>`,
      paths: [
        { d: smoothClosed(bank), fill: shade(pal.lit(pal.land(r.surface === 'snow' ? 'snow' : 'grass'), 0.05), 0.82) },
        { d: smoothClosed(l.pts), fill: 'url(#lake-grad)', ink: shade(bottom, 0.7) },
        ...ripples(geo, r, pal, seed), ...glitter(geo, r, seed),
      ],
    })
  }
  if (geo.river) {
    const pts = geo.river.pts
    const left: Pt[] = pts.map((p) => [p.x - p.w / 2, p.y] as Pt)
    const right: Pt[] = [...pts].reverse().map((p) => [p.x + p.w / 2, p.y] as Pt)
    const rng = mulberry32(subSeed(seed, 'river'))
    let hi = ''
    for (const p of pts) if (p.w > 40 && rng() < 0.55) hi += `M${f1(p.x - p.w * 0.2)} ${f1(p.y)}q${f1(p.w * 0.15)} -3 ${f1(p.w * 0.3)} 0`
    layers.push({
      id: 'river', depth: 0.6,
      paths: [
        { d: polyline([...left, ...right], true), fill: mix(top, bottom, 0.35) },
        ...(hi ? [{ d: hi, stroke: pal.water.line, strokeWidth: 2.4, opacity: 0.7 }] : []),
      ],
    })
  }
  return layers
}
