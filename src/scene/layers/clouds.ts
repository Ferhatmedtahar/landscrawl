import { mulberry32, subSeed } from '../../render/prng'
import { f1 } from '../geometry'
import type { Pal } from '../palette'
import type { Resolved } from '../resolve'
import { VIEW, type Layer, type PathSpec } from '../types'

/** A flat-bottomed cloud made of a row of rounded bumps. */
function cloudPath(cx: number, cy: number, w: number, h: number, rng: () => number): string {
  const bumps = 4 + Math.floor(rng() * 3)
  const xs: number[] = []
  for (let i = 0; i <= bumps; i++) xs.push(cx - w / 2 + (w * (i + (i > 0 && i < bumps ? (rng() - 0.5) * 0.5 : 0))) / bumps)
  let d = `M${f1(xs[0] as number)} ${f1(cy)}`
  for (let i = 0; i < bumps; i++) {
    const x0 = xs[i] as number, x1 = xs[i + 1] as number
    const lift = h * (0.35 + 0.8 * rng()) * (1 - Math.abs(i - (bumps - 1) / 2) / bumps)
    d += `C${f1(x0 - 6)} ${f1(cy - lift * 1.25)} ${f1(x1 + 6)} ${f1(cy - lift * 1.25)} ${f1(x1)} ${f1(cy)}`
  }
  return d + 'Z'
}

export function cloudsLayer(r: Resolved, pal: Pal, seed: number): Layer {
  const c = r.weather.clouds
  const rng = mulberry32(subSeed(seed, 'clouds'))
  const paths: PathSpec[] = []
  if (c > 0.02) {
    const n = Math.round(1 + c * 9)
    for (let i = 0; i < n; i++) {
      const w = 160 + rng() * 260 + c * 160
      const cx = rng() * VIEW.w
      const cy = 90 + rng() * 250 * (1 - c * 0.3)
      const h = 40 + rng() * 40 + c * 30
      const d = cloudPath(cx, cy, w, h, rng)
      paths.push({ d, fill: pal.cloud.shade, opacity: 0.55 })
      paths.push({ d: cloudPath(cx, cy - 5, w * 0.96, h, mulberry32(subSeed(seed, `cloud-${i}`))), fill: pal.cloud.body, opacity: 0.55 + 0.4 * Math.min(1, c * 1.3), outline: true })
    }
    if (c > 0.7) {
      // heavy overcast: a low grey sheet across the top
      paths.push({ d: `M0 0H${VIEW.w}V${f1(260 + c * 120)}H0Z`, fill: 'url(#overcast-grad)', opacity: Math.min(1, (c - 0.55) * 2.2) })
    }
  }
  const defs = c > 0.7 ? `<linearGradient id="overcast-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.cloud.shade}" stop-opacity="0.95"/><stop offset="1" stop-color="${pal.cloud.shade}" stop-opacity="0"/></linearGradient>` : ''
  return { id: 'clouds', depth: 0.05, defs, paths }
}
