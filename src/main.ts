import { parse } from './parser/parse'
import { renderSvg } from './render/svgRenderer'
import { buildScene } from './scene/buildScene'

function fromHash(): { text: string; seed: number } {
  const p = new URLSearchParams(location.hash.slice(1))
  const s = p.get('s')
  return {
    text: p.get('t') ?? 'sunset over snowy mountains, a small cabin with a lit window, pine forest',
    seed: s !== null && /^\d+$/.test(s) ? Number(s) >>> 0 : (crypto.getRandomValues(new Uint32Array(1))[0] as number),
  }
}

const stage = document.getElementById('stage') as HTMLElement
const input = document.getElementById('text') as HTMLTextAreaElement
const unknown = document.getElementById('unknown') as HTMLElement
const init = fromHash()
input.value = init.text

function draw(): void {
  const state = parse(input.value)
  stage.innerHTML = renderSvg(buildScene(state, init.seed))
  const bits: string[] = []
  if (state.unknownWords.length) bits.push(`I didn't know: ${state.unknownWords.join(', ')}`)
  if (state.unusedWords.length) bits.push(`Not used: ${state.unusedWords.join(', ')}`)
  unknown.textContent = bits.join(' · ')
}

input.addEventListener('input', draw)
draw()
