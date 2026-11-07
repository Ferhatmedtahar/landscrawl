import type { Match } from './match'

const FIRST_GAP = 3
const CHAIN_GAP = 2

/**
 * Mark traits that a "no", "without", "not" or "minus" reaches.
 * Reach: the first trait within 3 tokens, then onward through "or"/"nor" ("no snow or wind").
 * Clause boundaries stop it. A negator that reaches nothing is left with `used = false`.
 */
export function resolveNegations(matches: Match[]): void {
  type State = 'idle' | 'seek' | 'afterTrait' | 'afterConnector'
  let state: State = 'idle'
  let anchor = 0
  let negator: Match | undefined

  const giveUp = () => { state = 'idle'; negator = undefined }

  for (const m of matches) {
    if (m.kind === 'boundary') { giveUp(); continue }
    if (m.kind === 'negator') {
      negator = m
      m.used = false
      state = 'seek'
      anchor = m.end
      continue
    }
    if (state === 'idle') continue
    if (m.kind === 'trait') {
      const gap = m.start - anchor
      const limit = state === 'seek' ? FIRST_GAP : CHAIN_GAP
      if (state !== 'afterTrait' && gap <= limit) {
        m.negated = true
        if (negator) negator.used = true
        state = 'afterTrait'
        anchor = m.end
      } else giveUp()
      continue
    }
    if (m.kind === 'connector' && state === 'afterTrait' && m.start === anchor) {
      state = 'afterConnector'
      anchor = m.end
      continue
    }
    // modifiers, colours, stopwords, unknown words: allowed in between while the gap stays small
    if (state === 'afterTrait') { giveUp(); continue }
    if (m.end - anchor > (state === 'seek' ? FIRST_GAP : CHAIN_GAP)) giveUp()
  }
}
