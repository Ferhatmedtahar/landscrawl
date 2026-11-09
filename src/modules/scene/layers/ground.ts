import { mulberry32, subSeed } from '../../shared/prng'
import { areaBelow, cliffGeometry, EDGE, f1, HORIZON, polyline, STEP, type Profile, type Pt, type WaterGeo } from '../layout/geometry'
import { mix, shade } from '../../shared/color'
import type { LandKind, Pal } from '../style/palette'
import { makeProfile, shadowFacets } from '../layout/profiles'
import type { Resolved } from '../model/resolve'
import { VIEW, type Layer, type PathSpec } from '../model/types'

const landFor = (r: Resolved): LandKind => (r.surface === 'rock' ? (r.backdrop === 'canyon' ? 'canyon' : 'rock') : r.surface)

/** Layer 7a: the plain between the far land and the water, drawn before the water. */
export function groundMid(r: Resolved, pal: Pal, seed: number): Layer {
  const sand = r.surface === 'sand'
  const profile = makeProfile(sand ? 'dunes' : 'hills', subSeed(seed, 'ground-mid'), sand ? 690 : 618, sand ? 100 : r.surface === 'snow' ? 18 : 34)
  const color = pal.lit(pal.land(landFor(r)), 0.1)
  const paths: PathSpec[] = [{ d: areaBelow(profile), fill: 'url(#ground-grad)', ink: shade(color, 0.62) }]
  if (sand) for (const d of shadowFacets(profile, 12, 0.9)) paths.push({ d, fill: shade(color, 0.78), opacity: 0.65 })
  const defs = `<linearGradient id="ground-grad" gradientUnits="userSpaceOnUse" x1="0" y1="560" x2="0" y2="900"><stop offset="0" stop-color="${mix(color, pal.sky[2], 0.3)}"/><stop offset="0.45" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, 0.78)}"/></linearGradient>`
  return { id: 'ground-mid', depth: 0.55, defs, paths }
}

const isSandy = (r: Resolved, water: WaterGeo) => r.surface === 'sand' || (water.sea !== undefined && r.beach)

/** The edge of the near strip: where dry land begins in front of the water. */
export function shoreProfile(r: Resolved, seed: number, water: WaterGeo): Profile {
  const sand = isSandy(r, water)
  return makeProfile(sand ? 'dunes' : 'hills', subSeed(seed, 'ground-shore'), water.sea ? (r.beach ? 815 : 870) : 850, water.sea ? (r.beach ? 70 : 34) : sand ? 62 : 40)
}

/** Layer 7b: the near strip in front of the water: beach, bank, cliff. */
export function groundNear(r: Resolved, pal: Pal, seed: number, water: WaterGeo): Layer {
  const rng = mulberry32(subSeed(seed, 'ground-near'))
  const side = cliffGeometry(seed).side
  const paths: PathSpec[] = []
  const sand = isSandy(r, water)
  const kind: LandKind = sand ? 'sand' : landFor(r)
  const color = shade(pal.lit(pal.land(kind), 0), 0.94)

  const shore = shoreProfile(r, seed, water)
  paths.push({ d: areaBelow(shore), fill: color })
  if (sand) for (const d of shadowFacets(shore, 10, 0.9)) paths.push({ d, fill: shade(color, 0.84), opacity: 0.5 })
  if (water.sea) {
    const pts: Pt[] = []
    for (let x = -EDGE; x <= VIEW.w + EDGE; x += STEP) pts.push([x, shore(x) - 5])
    paths.push({ d: polyline(pts), stroke: '#ffffff', strokeWidth: 3.5, opacity: 0.55 })
  }

  if (r.cliffs) {
    const x0 = side === 0 ? 0 : VIEW.w
    const dir = side === 0 ? 1 : -1
    const { top, w } = cliffGeometry(seed)
    const pts: Pt[] = [[x0, top - 20]]
    for (let i = 1; i <= 6; i++) pts.push([x0 + dir * (w * 0.5 * (i / 6)), top - 20 + (i % 2 ? 6 : -4) + i * 3])
    pts.push([x0 + dir * w * 0.62, top + 30], [x0 + dir * (w - 36), top + 38], [x0 + dir * w, top + 34])
    let y = top + 60
    while (y < VIEW.h + 40) {
      pts.push([x0 + dir * (w - 14 + (rng() - 0.5) * 38), y])
      y += 52
    }
    pts.push([x0, VIEW.h + 20])
    const rock = pal.lit(pal.land('cliffs'), 0.05)
    paths.push({ d: polyline(pts, true), fill: rock })
    paths.push({ d: polyline(pts.slice(0, 11).concat([[x0 + dir * w * 0.62, top + 44], [x0, top + 40]]), true), fill: pal.lit(r.snowCover > 0.5 ? '#f1f6fa' : pal.land('grass'), 0.05) })
    let cracks = ''
    for (let i = 0; i < 9; i++) {
      const cx = x0 + dir * (w * (0.25 + rng() * 0.72)), cy = top + 60 + rng() * 300
      cracks += `M${f1(cx)} ${f1(cy)}l${f1((rng() - 0.5) * 12)} ${f1(40 + rng() * 60)}`
    }
    paths.push({ d: cracks, stroke: shade(rock, 0.6), strokeWidth: 2.4, opacity: 0.7 })
  }
  void HORIZON
  return { id: 'ground-near', depth: 0.8, paths }
}
