import { renderSvg } from './render/svgRenderer'
import { buildScene } from './scene/buildScene'
import { emptyScene } from './scene/types'

function seedFromHash(): number {
  const m = /[#&]s=(\d+)/.exec(location.hash)
  return m ? Number(m[1]) >>> 0 : (crypto.getRandomValues(new Uint32Array(1))[0] as number)
}

const stage = document.getElementById('stage')
if (stage) {
  const state = { ...emptyScene(), time: 'sunset' as const }
  stage.innerHTML = renderSvg(buildScene(state, seedFromHash()))
}
