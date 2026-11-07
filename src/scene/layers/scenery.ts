import { f1, polyline, type Pt, type WaterGeo } from '../geometry'
import { circlePath } from '../geometry'
import { mix } from '../color'
import type { Pal } from '../palette'
import { makeGround, placeScenery, type Scenery } from '../placement'
import type { Resolved } from '../resolve'
import { darkness, drawObjects, drawTrees } from '../shapes'
import { shoreProfile } from './ground'
import { VIEW, type Layer, type PathSpec } from '../types'

export interface SceneryResult { layers: Layer[]; scenery: Scenery }

function roadPaths(road: NonNullable<Scenery['road']>, r: Resolved, pal: Pal): PathSpec[] {
  const left: Pt[] = road.map((p) => [p.x - p.hw, p.y])
  const right: Pt[] = [...road].reverse().map((p) => [p.x + p.hw, p.y])
  const dirt = pal.lit(r.surface === 'snow' ? '#dfe6ec' : r.surface === 'sand' ? '#cfae78' : '#b8a27a', 0.1)
  const center = road.filter((_, i) => i % 2 === 0 && i > 2).map((p) => `M${f1(p.x - p.hw * 0.08)} ${f1(p.y)}h${f1(p.hw * 0.16)}`).join('')
  return [
    { d: polyline([...left, ...right], true), fill: dirt },
    ...(center ? [{ d: center, stroke: mix(dirt, '#ffffff', 0.4), strokeWidth: 3, opacity: 0.6 }] : []),
  ]
}

/** Layers 8 and 9: plants, buildings and creatures, plus the glow of anything lit at dusk and night. */
export function sceneryLayers(r: Resolved, pal: Pal, seed: number, water: WaterGeo): SceneryResult {
  const ground = makeGround(r, seed, water, shoreProfile(r, seed, water))
  const scenery = placeScenery(r, seed, water, ground)
  const layers: Layer[] = []

  if (scenery.road) layers.push({ id: 'road', depth: 0.6, paths: roadPaths(scenery.road, r, pal) })

  const trees = drawTrees(scenery.trees, r, pal)
  if (trees.length) layers.push({ id: 'vegetation', depth: 0.7, paths: trees })

  const drawn = drawObjects(scenery.objects, r, pal)
  if (drawn.paths.length) layers.push({ id: 'objects', depth: 0.75, paths: drawn.paths })

  const dark = darkness(r.time)
  if (dark > 0.05 && (drawn.glows.length || drawn.beams.length)) {
    const strength = Math.min(1, dark + 0.2)
    const defs =
      `<radialGradient id="glow-warm"><stop offset="0" stop-color="#ffd66b" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ffb347" stop-opacity="0.45"/><stop offset="1" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="glow-fire"><stop offset="0" stop-color="#ffd24a" stop-opacity="0.9"/><stop offset="0.4" stop-color="#ff7a2e" stop-opacity="0.4"/><stop offset="1" stop-color="#ff5a1e" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.7"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></linearGradient>`
    const paths: PathSpec[] = []
    for (const b of drawn.beams) {
      const x2 = b.x + b.dir * b.len
      // gradient runs left to right, so flip the polygon's box when the beam points left
      paths.push({ d: polyline([[b.x, b.y], [x2, b.y - 40], [x2, b.y + 26]], true), fill: b.dir === 1 ? 'url(#beam)' : 'url(#beam-l)', opacity: 0.6 * strength, still: true })
    }
    for (const g of drawn.glows) paths.push({ d: circlePath(g.x, g.y, g.r), fill: g.kind === 'fire' ? 'url(#glow-fire)' : 'url(#glow-warm)', opacity: strength, still: true })
    const flipped = defs + `<linearGradient id="beam-l" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.7"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></linearGradient>`
    layers.push({ id: 'glow', depth: 0.75, defs: flipped, paths })
  }
  void VIEW
  return { layers, scenery }
}
