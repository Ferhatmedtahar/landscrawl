import { VIEW, type Layer } from '../model/types'
import type { Pal } from '../style/palette'

export function skyLayer(pal: Pal): Layer {
  const [top, mid, bottom] = pal.sky
  return {
    id: 'sky',
    depth: 0,
    defs: `<linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`,
    paths: [{ d: `M0 0H${VIEW.w}V${VIEW.h}H0Z`, fill: 'url(#sky-grad)' }],
  }
}
