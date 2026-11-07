import { mulberry32 } from '../render/prng'

/** Seeded 1D fractal value noise, output roughly in [-1, 1]. */
export function makeNoise1D(seed: number, octaves = 4): (x: number) => number {
  const size = 256
  const rng = mulberry32(seed)
  const lattice = Array.from({ length: size }, () => rng() * 2 - 1)
  const at = (i: number) => lattice[((i % size) + size) % size] as number
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const base = (x: number) => {
    const i = Math.floor(x)
    const t = smooth(x - i)
    return at(i) * (1 - t) + at(i + 1) * t
  }
  return (x: number) => {
    let sum = 0, amp = 1, freq = 1, norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += base(x * freq) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return sum / norm
  }
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed | 0, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth seeded 2D value noise in [-1, 1]. Coherent: nearby points get nearly the same value. */
export function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed)
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1
}
