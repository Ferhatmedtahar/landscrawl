import { mulberry32, subSeed } from '../../shared/prng'
import { f1, inWater, smoothClosed, type Pt, type WaterGeo } from '../layout/geometry'
import { mix, shade } from '../../shared/color'
import type { Pal } from '../style/palette'
import type { Resolved } from '../model/resolve'
import { VIEW, type Layer, type PathSpec } from '../model/types'

const FLOWER_COLORS = ['#f06a8d', '#f4d548', '#ffffff', '#a07be8', '#ef6a3f']

/** Layer 10: grass tufts, rocks, flowers and snow drifts at the very front. */
export function foregroundLayer(r: Resolved, pal: Pal, seed: number, water: WaterGeo): Layer {
  const rng = mulberry32(subSeed(seed, 'foreground'))
  const paths: PathSpec[] = []
  const grassy = r.surface === 'grass' || r.surface === 'marsh'
  const blade = shade(pal.lit(pal.land(r.surface === 'marsh' ? 'marsh' : 'grass'), 0), 0.72)

  // grass tufts
  const tufts = Math.round(r.grass * 70)
  let d = ''
  for (let i = 0; i < tufts; i++) {
    const x = rng() * VIEW.w, y = 800 + rng() * 120
    if (inWater(water, x, y)) continue
    const h = 22 + (y - 800) * 0.45 + rng() * 16
    for (let b = -1; b <= 1; b++) d += `M${f1(x + b * 6)} ${f1(y)}q${f1(b * 8 + (rng() - 0.5) * 6)} ${f1(-h * 0.55)} ${f1(b * 13)} ${f1(-h)}`
  }
  if (d) paths.push({ d, stroke: blade, strokeWidth: 2.6, opacity: 0.9 })

  // flowers
  const flowers = Math.round(r.flowers * 45)
  for (let i = 0; i < flowers; i++) {
    const x = rng() * VIEW.w, y = 810 + rng() * 100
    if (inWater(water, x, y)) continue
    const h = 28 + rng() * 22, color = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)] as string
    paths.push({ d: `M${f1(x)} ${f1(y)}q${f1((rng() - 0.5) * 8)} ${f1(-h / 2)} 0 ${f1(-h)}`, stroke: blade, strokeWidth: 2 })
    let petals = ''
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2
      petals += `M${f1(x + Math.cos(a) * 5)} ${f1(y - h + Math.sin(a) * 5)}h0.1`
    }
    paths.push({ d: petals, stroke: color, strokeWidth: 6, opacity: 0.95 })
    paths.push({ d: `M${f1(x)} ${f1(y - h)}h0.1`, stroke: '#f6c344', strokeWidth: 4.5 })
  }

  // rocks
  const rocks = r.surface === 'snow' ? 2 : 3 + Math.floor(rng() * 3)
  const rock = pal.lit(pal.land('cliffs'), 0)
  for (let i = 0; i < rocks; i++) {
    const cx = 60 + rng() * (VIEW.w - 120), cy = 845 + rng() * 45
    if (inWater(water, cx, cy)) continue
    const w = 30 + rng() * 60, h = w * (0.45 + rng() * 0.25)
    const pts: Pt[] = [[cx - w, cy], [cx - w * 0.7, cy - h * 0.75], [cx - w * 0.1, cy - h], [cx + w * 0.6, cy - h * 0.7], [cx + w, cy], [cx + w * 0.4, cy + h * 0.18], [cx - w * 0.5, cy + h * 0.15]]
    paths.push({ d: smoothClosed(pts), fill: rock })
    paths.push({ d: smoothClosed([[cx - w * 0.55, cy - h * 0.45], [cx - w * 0.1, cy - h * 0.85], [cx + w * 0.3, cy - h * 0.6], [cx - w * 0.2, cy - h * 0.35]]), fill: mix(rock, '#ffffff', 0.22) })
    if (r.snowCover > 0.3) paths.push({ d: smoothClosed([[cx - w * 0.6, cy - h * 0.6], [cx - w * 0.1, cy - h * 1.02], [cx + w * 0.55, cy - h * 0.72], [cx, cy - h * 0.55]]), fill: pal.snow })
  }

  // sand ripples / snow drifts
  if (r.surface === 'sand') {
    let rip = ''
    for (let i = 0; i < 14; i++) {
      const x = rng() * VIEW.w, y = 830 + rng() * 70, len = 60 + rng() * 120
      if (!inWater(water, x, y)) rip += `M${f1(x)} ${f1(y)}q${f1(len / 2)} -6 ${f1(len)} 0`
    }
    paths.push({ d: rip, stroke: shade(pal.lit(pal.land('sand'), 0), 0.82), strokeWidth: 2.4, opacity: 0.8 })
  } else if (r.surface === 'snow') {
    for (let i = 0; i < 4; i++) {
      const cx = rng() * VIEW.w, cy = 880 + rng() * 25, w = 140 + rng() * 200
      paths.push({ d: smoothClosed([[cx - w, cy + 30], [cx - w * 0.4, cy - 22], [cx + w * 0.3, cy - 30], [cx + w, cy + 30], [cx, cy + 46]]), fill: pal.snow })
    }
  }
  void grassy
  return { id: 'foreground', depth: 1, paths }
}
