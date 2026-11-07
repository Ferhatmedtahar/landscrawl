import { describe, expect, it } from 'vitest'
import { renderSvg } from '../src/render/svgRenderer'
import { buildScene } from '../src/scene/buildScene'
import { emptyScene } from '../src/scene/types'

const render = (seed: number, time: 'sunset' | 'night' = 'sunset') =>
  renderSvg(buildScene({ ...emptyScene(), time }, seed))

describe('determinism', () => {
  it('same state + seed gives byte-identical SVG', () => {
    expect(render(123)).toBe(render(123))
  })
  it('different seed gives a different drawing', () => {
    expect(render(1)).not.toBe(render(2))
  })
  it('time of day changes colours', () => {
    expect(render(1, 'sunset')).not.toBe(render(1, 'night'))
  })
  it('layers come back to front: sky first', () => {
    const layers = buildScene(emptyScene(), 1)
    expect(layers[0]?.id).toBe('sky')
    expect(layers.length).toBeGreaterThan(1)
  })
})
