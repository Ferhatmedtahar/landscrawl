import { waterGeometry } from './geometry'
import { celestialLayer } from './layers/celestial'
import { cloudsLayer } from './layers/clouds'
import { foregroundLayer } from './layers/foreground'
import { groundMid, groundNear } from './layers/ground'
import { paperLayer } from './layers/paper'
import { skyLayer } from './layers/sky'
import { terrainLayers } from './layers/terrain'
import { waterLayers } from './layers/water'
import { weatherLayers } from './layers/weather'
import { makePalette } from './palette'
import { resolveScene } from './resolve'
import type { Layer, SceneState } from './types'

/** Pure: same state + seed always gives the same ordered layers (back to front). */
export function buildScene(state: SceneState, seed: number): Layer[] {
  const r = resolveScene(state, seed)
  const pal = makePalette(r)
  const water = waterGeometry(r, seed)
  return [
    skyLayer(pal),
    celestialLayer(r, pal),
    cloudsLayer(r, pal, seed),
    ...terrainLayers(r, pal, seed),
    groundMid(r, pal, seed),
    ...waterLayers(r, pal, seed, water),
    groundNear(r, pal, seed, water),
    foregroundLayer(r, pal, seed, water),
    ...weatherLayers(r, pal, seed),
    paperLayer(seed),
  ]
}
