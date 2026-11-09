import { mulberry32, subSeed } from '../../shared/prng'
import { areaBelow, circlePath, EDGE, f1, HORIZON, polyline, STEP, type Profile, type Pt } from '../layout/geometry'
import { mix, shade } from '../../shared/color'
import type { LandKind, Pal } from '../style/palette'
import { makeProfile, shadowFacets, snowCaps, type ProfileKind } from '../layout/profiles'
import type { Resolved } from '../model/resolve'
import { VIEW, type Layer, type PathSpec } from '../model/types'

interface Row { kind: ProfileKind; land: LandKind; base: number; amp: number; haze: number; depth: number }

function plan(r: Resolved): { far: Row; rows: Row[] } {
  const far = (kind: ProfileKind, land: LandKind, base: number, amp: number): Row => ({ kind, land, base, amp, haze: 0.85, depth: 0.12 })
  const row = (kind: ProfileKind, land: LandKind, base: number, amp: number, haze: number, depth: number): Row => ({ kind, land, base, amp, haze, depth })
  switch (r.backdrop) {
    case 'mountains': return { far: far('mountains', 'mountains', 470, 115), rows: [row('mountains', 'mountains', 525, 215, 0.5, 0.25), row('mountains', 'mountains', 592, 150, 0.22, 0.4)] }
    case 'glacier': return { far: far('glacier', 'glacier', 470, 110), rows: [row('glacier', 'glacier', 525, 210, 0.45, 0.25), row('glacier', 'glacier', 592, 140, 0.2, 0.4)] }
    case 'volcano': return { far: far('mountains', 'mountains', 480, 100), rows: [row('volcano', 'volcano', 540, 200, 0.4, 0.25), row('hills', 'hills', 598, 60, 0.2, 0.4)] }
    case 'mesa': return { far: far('hills', 'hills', 505, 50), rows: [row('mesa', 'mesa', 505, 170, 0.45, 0.25), row('mesa', 'mesa', 580, 110, 0.2, 0.4)] }
    case 'canyon': return { far: far('hills', 'hills', 505, 50), rows: [row('mesa', 'canyon', 505, 190, 0.45, 0.25), row('mesa', 'canyon', 585, 120, 0.2, 0.4)] }
    case 'dunes': return { far: far('dunes', 'dunes', 525, 55), rows: [row('dunes', 'dunes', 560, 150, 0.5, 0.25), row('dunes', 'dunes', 610, 120, 0.22, 0.4)] }
    case 'valley': return { far: far('mountains', 'mountains', 480, 100), rows: [row('valley', 'valley', 565, 210, 0.4, 0.25), row('hills', 'hills', 602, 60, 0.18, 0.4)] }
    case 'hills': return { far: far('hills', 'hills', 505, 50), rows: [row('hills', 'hills', 548, 90, 0.5, 0.25), row('hills', 'hills', 592, 70, 0.22, 0.4)] }
    default: {
      if (r.backdrop === 'cliffs') return { far: far('hills', 'hills', 510, 70), rows: [row('hills', 'hills', 560, 80, 0.45, 0.25), row('hills', 'hills', 598, 50, 0.2, 0.4)] }
      const land: LandKind = r.backdrop === 'plains' ? 'plains' : r.backdrop === 'savanna' ? 'savanna' : r.backdrop === 'swamp' ? 'swamp' : r.backdrop === 'tundra' ? 'tundra' : 'hills'
      return { far: far('hills', 'hills', 522, 40), rows: [row('flat', land, 572, 34, 0.4, 0.25), row('flat', land, 602, 24, 0.2, 0.4)] }
    }
  }
}

function bands(profile: Profile, base: number, amp: number, colors: string[]): PathSpec[] {
  const levels = [0.2, 0.42, 0.64, 0.86].map((f) => base - amp * (1 - f) )
  const out: PathSpec[] = []
  for (let i = 0; i < levels.length; i++) {
    const yA = levels[i] as number, yB = (levels[i + 1] ?? base + 14) as number
    const top: Pt[] = []
    let any = false
    for (let x = -EDGE; x <= VIEW.w + EDGE; x += STEP) {
      const y = Math.min(yB, Math.max(yA, profile(x)))
      if (profile(x) < yB) any = true
      top.push([x, y])
    }
    if (!any) continue
    out.push({ d: polyline(top) + `L${VIEW.w + EDGE} ${f1(yB)}L${-EDGE} ${f1(yB)}Z`, fill: colors[i % colors.length] as string, opacity: 0.55 })
  }
  return out
}

function rowLayer(id: string, row: Row, r: Resolved, pal: Pal, seed: number): Layer {
  const profile = makeProfile(row.kind, subSeed(seed, id), row.base, row.amp)
  const body = pal.lit(pal.land(row.land), row.haze)
  const paths: PathSpec[] = [{ d: areaBelow(profile), fill: body }]
  const defs = ''

  if (row.kind === 'mountains' || row.kind === 'glacier' || row.kind === 'volcano') {
    const cover = row.kind === 'glacier' ? Math.max(r.snowCover, 0.55) : r.snowCover
    const dark = shade(body, 0.78)
    for (const d of shadowFacets(profile, row.amp * 0.16)) paths.push({ d, fill: dark, opacity: 0.5, hatch: row.haze < 0.6 })
    if (cover > 0.05 && row.kind !== 'volcano') {
      const line = row.base - row.amp * (0.85 - 0.6 * cover)
      const snow = pal.lit('#f4f8fb', row.haze * 0.7)
      for (const d of snowCaps(profile, line, row.amp * 0.38, subSeed(seed, id))) paths.push({ d, fill: snow })
    }
  } else if (row.kind === 'dunes') {
    for (const d of shadowFacets(profile, row.amp * 0.12, 0.9)) paths.push({ d, fill: shade(body, 0.8), opacity: 0.5, hatch: true })
  } else if (row.kind === 'mesa') {
    const light = mix(body, '#e9b985', 0.45), deep = shade(body, 0.72)
    paths.push(...bands(profile, row.base, row.amp, [light, body, deep, mix(body, '#8a3d2a', 0.4)]))
  }

  if (row.kind === 'volcano') {
    const px = profile.peakX ?? VIEW.w / 2
    const py = profile(px)
    const hot = r.time === 'night' || r.time === 'dusk' || r.time === 'sunset'
    paths.push({ d: polyline([[px - 24, py + 18], [px - 10, py + 4], [px + 8, py + 8], [px + 26, py + 18]], true), fill: hot ? '#ff7a2e' : '#8a3d2a', opacity: hot ? 0.95 : 0.7 })
    if (r.smoke) {
      const rng = mulberry32(subSeed(seed, 'volcano-smoke'))
      let puffs = ''
      for (let i = 0; i < 7; i++) puffs += circlePath(px + (i - 3) * 9 + (rng() - 0.5) * 20, py - 24 - i * 34, 18 + i * 7)
      paths.push({ d: puffs, fill: mix(pal.sky[1], '#555555', 0.5), opacity: 0.55 })
    }
  }

  if (r.waterfall && row.depth > 0.3) {
    const rng = mulberry32(subSeed(seed, 'waterfall'))
    const wx = 380 + rng() * 840
    const top = profile(wx) + 18
    const pts: Pt[] = []
    const bottom = row.base + 60
    for (let y = top; y <= bottom; y += 18) pts.push([wx + Math.sin(y * 0.05) * 4, y])
    paths.push({ d: polyline(pts), stroke: '#f2fbff', strokeWidth: 13, opacity: 0.9 })
    paths.push({ d: polyline(pts), stroke: '#bfe6f5', strokeWidth: 4, opacity: 0.8 })
    paths.push({ d: circlePath(wx, bottom + 4, 22), fill: '#ffffff', opacity: 0.55 })
  }
  return { id, depth: row.depth, defs, paths }
}

export function terrainLayers(r: Resolved, pal: Pal, seed: number): Layer[] {
  const p = plan(r)
  return [rowLayer('far', p.far, r, pal, seed), ...p.rows.map((row, i) => rowLayer(`terrain-${i}`, row, r, pal, seed))]
}

export { HORIZON }
