import type { Resolved } from '../scene/model/resolve'

const list = (items: string[]) => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items.at(-1))

/** One plain sentence for screen readers (the SVG's aria-label). */
export function describeScene(r: Resolved): string {
  const parts: string[] = []
  const surface = r.surface === 'snow' ? 'snowy ' : r.surface === 'sand' ? 'sandy ' : ''
  parts.push(`${surface}${r.backdrop}`)
  for (const t of r.terrain) if (t !== r.backdrop) parts.push(t)
  const v = r.vegetation
  if (v.pine > 0.05) parts.push('pine trees')
  if (v.forest > 0.05) parts.push('a forest')
  if (v.palm > 0.05) parts.push('palm trees')
  if (v.cactus > 0.05) parts.push('cacti')
  if (v.deadTrees > 0.05) parts.push('dead trees')
  if (v.loneTree) parts.push('a lone tree')
  for (const o of r.objects) { const name = o.kind === 'balloon' ? 'hot air balloon' : o.kind; parts.push(o.count > 1 ? `${o.count} ${name}s` : `a ${name}`) }
  if (r.fireflies && r.time !== 'day') parts.push('fireflies')
  const weather: string[] = []
  const w = r.weather
  if (w.rain > 0.1) weather.push(w.rain > 0.7 ? 'heavy rain' : 'rain')
  if (w.snow > 0.1) weather.push('falling snow')
  if (w.fog > 0.15) weather.push('fog')
  if (w.wind > 0.5) weather.push('wind')
  if (w.clouds > 0.6) weather.push('thick clouds')
  const sky: string[] = []
  if (r.sun) sky.push('the sun')
  if (r.moon !== 'none') sky.push(`a ${r.moon} moon`)
  if (r.stars > 0.3) sky.push('stars')
  if (r.aurora > 0.3) sky.push('northern lights')
  if (r.rainbow > 0.3) sky.push('a rainbow')
  let text = `A hand-drawn landscape at ${r.time}: ${list(parts)}`
  if (weather.length) text += `, with ${list(weather)}`
  if (sky.length) text += `. In the sky: ${list(sky)}`
  return text + '.'
}
