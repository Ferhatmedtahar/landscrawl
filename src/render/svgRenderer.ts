import { VIEW, type Layer, type PathSpec } from '../scene/types'

function pathToSvg(p: PathSpec): string {
  const attrs = [`d="${p.d}"`]
  if (p.fill) attrs.push(`fill="${p.fill}"`)
  if (p.stroke) attrs.push(`stroke="${p.stroke}"`, `stroke-width="${p.strokeWidth ?? 2}"`, 'stroke-linejoin="round"', 'stroke-linecap="round"')
  if (p.opacity !== undefined) attrs.push(`opacity="${p.opacity}"`)
  return `<path ${attrs.join(' ')}/>`
}

/** Pure: layers to an SVG string. Byte-identical for identical input. */
export function renderSvg(layers: Layer[], label = 'A hand-drawn landscape'): string {
  const defs = layers.map((l) => l.defs ?? '').join('')
  const body = layers
    .map((l) => `<g id="${l.id}" data-depth="${l.depth}">${l.paths.map(pathToSvg).join('')}</g>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}"><defs>${defs}</defs>${body}</svg>`
}
