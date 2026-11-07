import { mulberry32, subSeed } from '../../render/prng'
import { circlePath, f1, HORIZON } from '../geometry'
import { makeNoise1D } from '../noise'
import { mix } from '../color'
import type { Pal } from '../palette'
import type { Resolved } from '../resolve'
import { VIEW, type Layer, type PathSpec } from '../types'

/** Layer 11: rain streaks, snowflakes, fog bands and wind swishes. */
export function weatherLayers(r: Resolved, pal: Pal, seed: number): Layer[] {
  const layers: Layer[] = []
  const w = r.weather

  if (w.fog > 0.02) {
    const noise = makeNoise1D(subSeed(seed, 'fog'), 2)
    const paths: PathSpec[] = []
    const bands = 4
    for (let b = 0; b < bands; b++) {
      const y = HORIZON - 150 + b * 105, hgt = 110
      const top: string[] = [], bot: string[] = []
      for (let x = -20; x <= VIEW.w + 20; x += 40) {
        const yy = y + noise(x * 0.003 + b * 7) * 34
        top.push(`${top.length ? 'L' : 'M'}${f1(x)} ${f1(yy)}`)
        bot.unshift(`L${f1(x)} ${f1(yy + hgt)}`)
      }
      paths.push({ d: top.join('') + bot.join('') + 'Z', fill: 'url(#fog-grad)', opacity: Math.min(0.9, w.fog * (0.55 + b * 0.12)) })
    }
    layers.push({
      id: 'fog', depth: 0.7,
      defs: `<linearGradient id="fog-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.fog}" stop-opacity="0"/><stop offset="0.5" stop-color="${pal.fog}" stop-opacity="0.9"/><stop offset="1" stop-color="${pal.fog}" stop-opacity="0"/></linearGradient>`,
      paths,
    })
  }

  if (w.rain > 0.02) {
    const rng = mulberry32(subSeed(seed, 'rain'))
    const count = Math.round(w.rain * 360)
    const slant = 0.18 + w.wind * 0.5
    const classes = ['', '', '']
    for (let i = 0; i < count; i++) {
      const k = i % 3
      const len = [14, 24, 36][k] as number
      const x = rng() * (VIEW.w + 200) - 100, y = rng() * VIEW.h
      classes[k] += `M${f1(x)} ${f1(y)}l${f1(len * slant)} ${f1(len)}`
    }
    const col = mix(pal.sky[2], '#ffffff', 0.55)
    layers.push({
      id: 'rain', depth: 0.9,
      paths: classes.map((d, k) => ({ d, stroke: col, strokeWidth: [1, 1.5, 2.2][k] as number, opacity: [0.3, 0.42, 0.55][k] as number })),
    })
  }

  if (w.snow > 0.02) {
    const rng = mulberry32(subSeed(seed, 'snow'))
    const count = Math.round(w.snow * 260)
    const classes = ['', '', '']
    for (let i = 0; i < count; i++) {
      const k = i % 3
      classes[k] += circlePath(rng() * VIEW.w, rng() * VIEW.h, [1.6, 2.6, 4][k] as number)
    }
    layers.push({
      id: 'snow', depth: 0.9,
      paths: classes.map((d, k) => ({ d, fill: '#ffffff', opacity: [0.55, 0.75, 0.95][k] as number })),
    })
  }

  if (w.wind > 0.45) {
    const rng = mulberry32(subSeed(seed, 'wind'))
    let d = ''
    const n = Math.round(w.wind * 9)
    for (let i = 0; i < n; i++) {
      const x = rng() * VIEW.w * 0.8, y = 80 + rng() * 380, len = 120 + rng() * 200
      d += `M${f1(x)} ${f1(y)}c${f1(len * 0.3)} -14 ${f1(len * 0.6)} 14 ${f1(len)} -4`
    }
    layers.push({ id: 'wind', depth: 0.8, paths: [{ d, stroke: '#ffffff', strokeWidth: 2.2, opacity: 0.3 }] })
  }
  return layers
}
