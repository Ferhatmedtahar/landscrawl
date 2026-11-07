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
