import { mix, shade } from '../shared/color'
import { subSeed } from '../shared/prng'
import { flatten, jitterPolys, polysToD, type Poly } from './jitter'
import type { Layer, PathSpec } from '../scene/model/types'

export type ItemKind = 'fill' | 'stroke' | 'ink' | 'hatch'

/** One SVG <path> to draw. The structure (count and order) is the same for every variant. */
export interface DrawItem {
  kind: ItemKind
  d: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  /** Index of the layer path this item was made from (fill, hatch and ink items share it). */
  src: number
}

export interface DrawOptions {
  seed: number
  /** Which boil frame: different variants wobble differently. */
  variant: number
  /** Jitter in scene units (the scene is 1600 wide). 0 draws the exact geometry. */
  amp: number
  /** Add the double-line outline and hatch shading. */
  sketch: boolean
}

export const PLAIN: DrawOptions = { seed: 0, variant: 0, amp: 0, sketch: false }

const cache = new WeakMap<PathSpec, Poly[]>()
const polysOf = (p: PathSpec) => {
  let v = cache.get(p)
  if (!v) { v = flatten(p.d); cache.set(p, v) }
  return v
}

const isGradient = (f?: string) => !!f && f.startsWith('url(')
const hex = /^#[0-9a-f]{6}$/i

/** The line colour for a filled shape: a darker, slightly inky version of its fill. */
export function inkOf(fill: string): string {
  return mix(shade(fill, 0.5), '#14141f', 0.25)
}

function inkColor(p: PathSpec): string | undefined {
  if (p.outline === false || p.still) return undefined
  if (p.ink) return p.ink
  if (p.fill && hex.test(p.fill) && (p.outline === true || (p.opacity ?? 1) >= 0.9)) return inkOf(p.fill)
  return undefined
}

export function drawLayer(layer: Layer, o: DrawOptions): DrawItem[] {
  const items: DrawItem[] = []
  layer.paths.forEach((p, i) => {
    const base = subSeed(o.seed + o.variant * 7919, `${layer.id}:${i}`)
    const ink = o.sketch ? inkColor(p) : undefined
    const wobble = o.amp > 0 && !p.still && (!isGradient(p.fill) || ink !== undefined || p.stroke !== undefined)
    const d = wobble ? polysToD(jitterPolys(polysOf(p), base, o.amp)) : p.d
    const filled = p.fill !== undefined && p.fill !== 'none'
    items.push({ kind: filled ? 'fill' : 'stroke', d, fill: p.fill ?? 'none', stroke: p.stroke, strokeWidth: p.strokeWidth, opacity: p.opacity, src: i })
    if (o.sketch && p.hatch) items.push({ kind: 'hatch', d, fill: 'url(#hatch)', opacity: 0.55, src: i })
    if (ink) {
      for (let k = 0; k < 2; k++) {
        const dd = o.amp > 0 ? polysToD(jitterPolys(polysOf(p), subSeed(base, `ink${k}`), o.amp * (k === 0 ? 0.9 : 1.3))) : p.d
        items.push({ kind: 'ink', d: dd, fill: 'none', stroke: ink, strokeWidth: k === 0 ? 1.7 : 1.1, opacity: k === 0 ? 0.62 : 0.4, src: i })
      }
    }
  })
  return items
}

export const HATCH_DEF =
  '<pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V9" stroke="#0b0b18" stroke-width="1.5" opacity="0.5"/></pattern>'
