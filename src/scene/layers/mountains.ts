import { subSeed } from '../../render/prng'
import { makeNoise1D } from '../noise'
import { skyColors } from '../palette'
import { VIEW, type Layer, type SceneState } from '../types'

const STEP = 16

/** A ridge line as a closed filled polygon down to the bottom edge. */
export function ridgePath(noise: (x: number) => number, baseY: number, amp: number, freq: number, phase: number): string {
  let d = ''
  for (let x = 0; x <= VIEW.w + STEP; x += STEP) {
    const y = baseY + noise(x * freq + phase) * amp
    d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`
  }
  return `${d}L${VIEW.w} ${VIEW.h}L0 ${VIEW.h}Z`
}

export function mountainsLayers(state: SceneState, seed: number): Layer[] {
  const colors = skyColors(state.time).ridge
  const specs = [
    { id: 'mountains-far', baseY: 520, amp: 150, freq: 0.004, depth: 0.15 },
    { id: 'mountains-mid', baseY: 600, amp: 170, freq: 0.006, depth: 0.3 },
    { id: 'mountains-near', baseY: 690, amp: 130, freq: 0.008, depth: 0.5 },
  ]
  return specs.map((s, i) => {
    const noise = makeNoise1D(subSeed(seed, s.id), 5)
    return {
      id: s.id,
      depth: s.depth,
      paths: [{ d: ridgePath(noise, s.baseY, s.amp, s.freq, i * 10), fill: colors[i] ?? '#444' }],
    }
  })
}
