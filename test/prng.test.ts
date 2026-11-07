import { describe, expect, it } from 'vitest'
import { mulberry32, subSeed } from '../src/render/prng'

describe('mulberry32', () => {
  it('is deterministic', () => {
    const a = mulberry32(42), b = mulberry32(42)
    for (let i = 0; i < 50; i++) expect(a()).toBe(b())
  })
  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
  it('stays in [0, 1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('subSeed gives independent labelled streams', () => {
    expect(subSeed(5, 'a')).toBe(subSeed(5, 'a'))
    expect(subSeed(5, 'a')).not.toBe(subSeed(5, 'b'))
  })
})
