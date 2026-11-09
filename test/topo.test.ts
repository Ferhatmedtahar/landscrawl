import { describe, expect, it } from 'vitest'
import { topoLines, topoSvg } from '../src/modules/ui/topo'

const opts = { width: 800, height: 500, seed: 11 }

describe('topographic background', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(topoSvg(opts)).toBe(topoSvg(opts))
    expect(topoSvg({ ...opts, seed: 12 })).not.toBe(topoSvg(opts))
  })
  it('draws many contour levels, some of them major', () => {
    const lines = topoLines(opts)
    expect(lines.length).toBeGreaterThan(8)
    expect(lines.some((l) => l.major)).toBe(true)
    for (const l of lines) expect(l.d).not.toMatch(/NaN|Infinity/)
  })
})
