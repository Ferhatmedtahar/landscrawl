import { parse } from './parser/parse'
import { Stage } from './render/stage'
import { buildScene } from './scene/buildScene'

function fromHash(): { text: string; seed: number } {
  const p = new URLSearchParams(location.hash.slice(1))
  const s = p.get('s')
  return {
    text: p.get('t') ?? 'sunset over snowy mountains, a small cabin with a lit window, pine forest',
    seed: s !== null && /^\d+$/.test(s) ? Number(s) >>> 0 : (crypto.getRandomValues(new Uint32Array(1))[0] as number),
  }
}

const input = document.getElementById('text') as HTMLTextAreaElement
const unknown = document.getElementById('unknown') as HTMLElement
const stage = new Stage(document.getElementById('stage') as HTMLElement)
const init = fromHash()
input.value = init.text

function draw(): void {
  const state = parse(input.value)
  stage.setScene(buildScene(state, init.seed), init.seed)
  const bits: string[] = []
  if (state.unknownWords.length) bits.push(`I didn't know: ${state.unknownWords.join(', ')}`)
  if (state.unusedWords.length) bits.push(`Not used: ${state.unusedWords.join(', ')}`)
  unknown.textContent = bits.join(' · ')
}

input.addEventListener('input', draw)
draw()
