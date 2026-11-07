/** mulberry32: tiny seeded PRNG. Returns floats in [0, 1). Never use Math.random() in scene code. */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Derive an independent sub-seed so each layer has its own stable random stream. */
export function subSeed(seed: number, label: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x85ebca6b)
    h ^= h >>> 13
  }
  return h >>> 0
}
