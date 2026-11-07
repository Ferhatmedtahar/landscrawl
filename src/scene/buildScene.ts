import { mountainsLayers } from './layers/mountains'
import { skyLayer } from './layers/sky'
import type { Layer, SceneState } from './types'

/** Pure: same state + seed always gives the same ordered layers (back to front). */
export function buildScene(state: SceneState, seed: number): Layer[] {
  return [skyLayer(state), ...mountainsLayers(state, seed)]
}
