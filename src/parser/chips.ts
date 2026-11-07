import type { Chip } from './parse'

/** Delete a chip's words from the text and tidy the commas and spaces around the gap. */
export function removeChip(text: string, chip: Pick<Chip, 'start' | 'end'>): string {
  const lead = /\b(a|an|the)\s+$/i.exec(text.slice(0, chip.start))
  const start = lead ? chip.start - lead[0].length : chip.start
  const cut = text.slice(0, start) + text.slice(chip.end)
  return cut
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;])(\s*[,;])+/g, '$1')
    .replace(/^[\s,;.]+/, '')
    .replace(/[\s,;]+$/, '')
    .replace(/(^|[,;]\s)(and|with|or|a|an|the|of|over|at|in|on)\s*(?=[,;]|$)/gi, '$1')
    .replace(/[\s,;]+$/, '')
}
