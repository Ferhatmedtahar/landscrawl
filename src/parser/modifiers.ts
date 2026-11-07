import type { Match, MatchKind } from './match'

const SKIPPABLE: ReadonlySet<MatchKind> = new Set(['stop', 'modifier', 'color', 'unknown'])
const MAX_GAP = 2

/** Index of the nearest trait after `from`, within the same clause and a small token gap, or -1. */
export function nextTrait(matches: Match[], from: number): number {
  const origin = matches[from] as Match
  for (let j = from + 1; j < matches.length; j++) {
    const m = matches[j] as Match
    if (m.kind === 'boundary' || m.start - origin.end > MAX_GAP) return -1
    if (m.kind === 'trait') return j
    if (!SKIPPABLE.has(m.kind)) return -1
  }
  return -1
}

/** Heavy/light/tiny/huge/one/two... attach to the nearest following trait. */
export function attachModifiers(matches: Match[]): void {
  matches.forEach((m, i) => {
    if (m.kind !== 'modifier' || m.hit?.kind !== 'modifier') return
    const j = nextTrait(matches, i)
    if (j < 0) return
    const target = matches[j] as Match
    const e = m.hit.entry
    if (e.level !== undefined) target.level = e.level
    if (e.scale !== undefined) target.scale = e.scale
    if (e.quantity !== undefined) target.quantity = e.quantity
    m.attached = true
    m.target = j
  })
}

/** Colour words paint the nearest following noun, if that noun has a palette slot. */
export function attachColors(matches: Match[]): void {
  matches.forEach((m, i) => {
    if (m.kind !== 'color') return
    const j = nextTrait(matches, i)
    if (j < 0) return
    const target = matches[j] as Match
    if (target.hit?.kind === 'trait' && target.hit.entry.tint && !target.negated) { m.attached = true; m.target = j }
  })
}
