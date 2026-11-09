import { VIEW, type Layer } from '../scene/model/types'
import { drawLayer, HATCH_DEF, PLAIN, type DrawItem, type DrawOptions } from './draw'

export const RATIOS = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '9:16': 9 / 16 } as const
export type Ratio = keyof typeof RATIOS

export function itemToSvg(it: DrawItem): string {
  const a = [`d="${it.d}"`, `fill="${it.fill ?? 'none'}"`]
  if (it.stroke) a.push(`stroke="${it.stroke}"`, `stroke-width="${it.strokeWidth ?? 2}"`, 'stroke-linejoin="round"', 'stroke-linecap="round"')
  if (it.opacity !== undefined) a.push(`opacity="${Math.round(it.opacity * 100) / 100}"`)
  return `<path ${a.join(' ')}/>`
}

/** The part of the 16:9 scene a given ratio shows: centred, full height or full width. */
export function cropFor(ratio: Ratio): { x: number; y: number; w: number; h: number } {
  const target = RATIOS[ratio]
  if (target >= VIEW.w / VIEW.h) return { x: 0, y: 0, w: VIEW.w, h: VIEW.h }
  const w = VIEW.h * target
  return { x: (VIEW.w - w) / 2, y: 0, w, h: VIEW.h }
}

export interface RenderOptions { label?: string; draw?: DrawOptions; ratio?: Ratio }

/** Pure: layers to an SVG string. Byte-identical for identical input and options. */
export function renderSvg(layers: Layer[], opts: RenderOptions = {}): string {
  const label = opts.label ?? 'A hand-drawn landscape'
  const draw = opts.draw ?? PLAIN
  const crop = cropFor(opts.ratio ?? '16:9')
  const defs = layers.map((l) => l.defs ?? '').join('')
  const body = layers
    .map((l) => `<g id="${l.id}" data-depth="${l.depth}">${drawLayer(l, draw).map(itemToSvg).join('')}${l.raw ?? ''}</g>`)
    .join('')
  const frame = `<clipPath id="frame"><rect x="${crop.x}" y="${crop.y}" width="${crop.w}" height="${crop.h}" rx="28"/></clipPath>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label.replace(/"/g, '&quot;')}"><defs>${frame}${HATCH_DEF}${defs}</defs><g clip-path="url(#frame)">${body}</g></svg>`
}
