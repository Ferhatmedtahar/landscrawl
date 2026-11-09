import { mulberry32, subSeed } from '../../render/prng'
import { circlePath, f1, HORIZON } from '../geometry'
import { makeNoise1D } from '../noise'
import { mix } from '../color'
import type { Pal } from '../palette'
import type { Resolved } from '../resolve'
import { VIEW, type Layer, type PathSpec } from '../types'

export interface Body { x: number; y: number }

/** Where the sun and moon sit. Shared with the water layer for reflections. */
export function skyBodies(r: Resolved): { sun: Body; moon: Body } {
  const rng = mulberry32(subSeed(r.seed, 'bodies'))
  const [a, b, c] = [rng(), rng(), rng()] as [number, number, number]
  const sunBy = {
    dawn: { x: 260 + a * 300, y: HORIZON - 80 },
    day: { x: 500 + a * 700, y: 150 + b * 60 },
    sunset: { x: 900 + a * 450, y: HORIZON - 90 + b * 30 },
    dusk: { x: 1000 + a * 400, y: HORIZON + 20 },
    night: { x: 800, y: HORIZON + 200 },
  }[r.time]
  return { sun: sunBy, moon: { x: 280 + c * 1000, y: 120 + b * 140 } }
}

function crescent(cx: number, cy: number, rr: number): string {
  return `M${f1(cx)} ${f1(cy - rr)}A${f1(rr)} ${f1(rr)} 0 1 0 ${f1(cx)} ${f1(cy + rr)}A${f1(rr * 0.72)} ${f1(rr)} 0 1 1 ${f1(cx)} ${f1(cy - rr)}Z`
}
function halfMoon(cx: number, cy: number, rr: number): string {
  return `M${f1(cx)} ${f1(cy - rr)}A${f1(rr)} ${f1(rr)} 0 0 0 ${f1(cx)} ${f1(cy + rr)}Z`
}

function starPaths(r: Resolved, seed: number): PathSpec[] {
  const rng = mulberry32(subSeed(seed, 'stars'))
  const count = Math.round(r.stars * 170)
  const dim = 1 - r.weather.clouds * 0.7
  const classes: string[] = ['', '', '']
  for (let i = 0; i < count; i++) {
    const x = rng() * VIEW.w, y = rng() * (HORIZON - 110)
    const k = rng() < 0.12 ? 2 : rng() < 0.4 ? 1 : 0
    const rr = [1.1, 1.7, 2.6][k] as number
    classes[k] += circlePath(x, y, rr)
    if (k === 2) classes[2] += `M${f1(x - 7)} ${f1(y)}H${f1(x + 7)}M${f1(x)} ${f1(y - 7)}V${f1(y + 7)}`
  }
  const out: PathSpec[] = []
  if (classes[0]) out.push({ d: classes[0], fill: '#ffffff', opacity: 0.55 * dim, still: true })
  if (classes[1]) out.push({ d: classes[1], fill: '#fff8e0', opacity: 0.8 * dim, still: true })
  if (classes[2]) out.push({ d: classes[2], fill: '#fffdf0', stroke: '#fffdf0', strokeWidth: 1.2, opacity: 0.95 * dim, still: true })
  return out
}

function auroraPaths(r: Resolved, seed: number): { defs: string; paths: PathSpec[] } {
  const rng = mulberry32(subSeed(seed, 'aurora'))
  const noise = makeNoise1D(subSeed(seed, 'aurora-wave'), 3)
  const colors = ['#4ff0a8', '#38c7c0', '#a07be8']
  let defs = ''
  const paths: PathSpec[] = []
  colors.forEach((c, k) => {
    defs += `<linearGradient id="aurora-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="0.35" stop-color="${c}" stop-opacity="0.85"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`
    const y0 = 150 + k * 55 + rng() * 40, drop = 150 + rng() * 90
    const top: string[] = [], bottom: string[] = []
    for (let x = -20; x <= VIEW.w + 20; x += 16) {
      const y = y0 + noise(x * 0.0035 + k * 3) * 70
      top.push(`${top.length ? 'L' : 'M'}${f1(x)} ${f1(y)}`)
      bottom.unshift(`L${f1(x)} ${f1(y + drop * (0.6 + 0.4 * noise(x * 0.02 + k)))}`)
    }
    paths.push({ d: top.join('') + bottom.join('') + 'Z', fill: `url(#aurora-${k})`, opacity: 0.55 * r.aurora })
  })
  return { defs, paths }
}

const RAINBOW = ['#e8453c', '#f28c38', '#f5d94a', '#6cc26a', '#4aa3d8', '#4a5fc4', '#8a5bb8'] as const

/** Seven stroked arcs, red outside to violet inside, standing on the ground line. Fainter in the dark and under heavy cloud. */
function rainbowPaths(r: Resolved, seed: number): PathSpec[] {
  const rng = mulberry32(subSeed(seed, 'rainbow'))
  const cx = 380 + rng() * 840, big = 470 + rng() * 120, band = 15, cy = HORIZON + 60
  const dim = { night: 0.35, dusk: 0.6, dawn: 0.8, sunset: 0.9, day: 1 }[r.time]
  const opacity = Math.round((0.2 + 0.7 * r.rainbow) * dim * (1 - r.weather.clouds * 0.3) * 100) / 100
  return RAINBOW.map((color, k) => {
    const rad = big - k * band
    return { d: `M${f1(cx - rad)} ${f1(cy)}A${f1(rad)} ${f1(rad)} 0 0 1 ${f1(cx + rad)} ${f1(cy)}`, stroke: color, strokeWidth: band + 1, opacity }
  })
}

export function celestialLayer(r: Resolved, pal: Pal): Layer {
  const { sun, moon } = skyBodies(r)
  const dim = 1 - r.weather.clouds * 0.45
  let defs = ''
  const paths: PathSpec[] = []

  if (r.sun || r.time === 'sunset' || r.time === 'dawn') {
    const glow = r.time === 'sunset' || r.time === 'dawn' || r.time === 'dusk' ? 0.9 : 0.5
    defs += `<radialGradient id="sun-glow"><stop offset="0" stop-color="${pal.light}" stop-opacity="${f1(glow)}"/><stop offset="1" stop-color="${pal.light}" stop-opacity="0"/></radialGradient>`
    const gr = r.time === 'day' ? 280 : 520
    paths.push({ d: circlePath(sun.x, sun.y, gr), fill: 'url(#sun-glow)', opacity: dim })
  }
  if (r.sun) paths.push({ d: circlePath(sun.x, sun.y, r.time === 'day' ? 44 : 58), fill: '#fff4c8', opacity: dim, outline: false })

  if (r.moon !== 'none') {
    defs += `<radialGradient id="moon-glow"><stop offset="0" stop-color="#dfe6ff" stop-opacity="0.45"/><stop offset="1" stop-color="#dfe6ff" stop-opacity="0"/></radialGradient>`
    const faint = r.time === 'night' ? 1 : 0.55
    paths.push({ d: circlePath(moon.x, moon.y, 170), fill: 'url(#moon-glow)', opacity: dim * faint })
    const body = mix('#f4efdc', pal.sky[0], r.time === 'night' ? 0 : 0.25)
    if (r.moon === 'full') {
      paths.push({ d: circlePath(moon.x, moon.y, 44), fill: body, opacity: faint * (0.5 + dim / 2) })
      paths.push({ d: circlePath(moon.x - 14, moon.y - 8, 9) + circlePath(moon.x + 16, moon.y + 12, 6), fill: mix(body, '#8a90aa', 0.35), opacity: 0.6 * faint })
    } else if (r.moon === 'half') {
      paths.push({ d: circlePath(moon.x, moon.y, 44), stroke: body, strokeWidth: 1.2, opacity: 0.25 * faint })
      paths.push({ d: halfMoon(moon.x, moon.y, 44), fill: body, opacity: faint * (0.5 + dim / 2) })
    } else {
      paths.push({ d: crescent(moon.x, moon.y, 44), fill: body, opacity: faint * (0.5 + dim / 2) })
    }
  }

  if (r.stars > 0) paths.push(...starPaths(r, r.seed))
  if (r.aurora > 0) {
    const a = auroraPaths(r, r.seed)
    defs += a.defs
    paths.push(...a.paths)
  }
  if (r.rainbow > 0) paths.push(...rainbowPaths(r, r.seed))
  return { id: 'celestial', depth: 0.02, defs, paths }
}
