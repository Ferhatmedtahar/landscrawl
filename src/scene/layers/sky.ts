import { skyColors } from '../palette'
import { VIEW, type Layer, type SceneState } from '../types'

export function skyLayer(state: SceneState): Layer {
  const c = skyColors(state.time)
  return {
    id: 'sky',
    depth: 0,
    defs: `<linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/></linearGradient>`,
    paths: [{ d: `M0 0L${VIEW.w} 0L${VIEW.w} ${VIEW.h}L0 ${VIEW.h}Z`, fill: 'url(#sky-grad)' }],
  }
}
