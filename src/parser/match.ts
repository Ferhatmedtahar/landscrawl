import { findTypo, type Hit, type Lexicon } from '../lexicon'
import { BOUNDARY, stemPhrase } from './normalize'

export type MatchKind = 'trait' | 'modifier' | 'color' | 'negator' | 'connector' | 'stop' | 'boundary' | 'unknown'
export type Via = 'exact' | 'stem' | 'typo' | 'digit' | 'none'

export interface Match {
  /** Token index range [start, end). */
  start: number
  end: number
  text: string
  kind: MatchKind
  hit?: Hit
  via: Via
  confidence: number
  negated?: boolean
  /** For negators: did they find something to negate? */
  used?: boolean
  level?: number
  scale?: number
  quantity?: number
  /** For modifiers and colours: attached to a noun? */
  attached?: boolean
  /** Index (in the match list) of the trait this modifier or colour belongs to. */
  target?: number
}

const CONFIDENCE: Record<Via, number> = { exact: 1, stem: 0.9, typo: 0.6, digit: 1, none: 0 }

function lookup(lex: Lexicon, phrase: string): { hit: Hit; via: Via } | undefined {
  const e = lex.exact.get(phrase)
  if (e) return { hit: e, via: 'exact' }
  const s = lex.stemmed.get(stemPhrase(phrase))
  if (s) return { hit: s, via: 'stem' }
  return undefined
}

/** Scan tokens left to right, longest phrase first (3 words, then 2, then 1). */
export function scan(tokens: string[], lex: Lexicon): Match[] {
  const out: Match[] = []
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i] as string
    if (tok === BOUNDARY) {
      out.push({ start: i, end: i + 1, text: tok, kind: 'boundary', via: 'none', confidence: 0 })
      i++
      continue
    }
    let found: Match | undefined
    for (let n = Math.min(3, tokens.length - i); n >= 1 && !found; n--) {
      const words = tokens.slice(i, i + n)
      if (words.includes(BOUNDARY)) continue
      const phrase = words.join(' ')
      const r = lookup(lex, phrase)
      if (r) found = { start: i, end: i + n, text: phrase, kind: r.hit.kind, hit: r.hit, via: r.via, confidence: CONFIDENCE[r.via] }
    }
    if (!found && /^\d+$/.test(tok)) {
      found = { start: i, end: i + 1, text: tok, kind: 'modifier', via: 'digit', confidence: 1, hit: { kind: 'modifier', entry: { keys: [tok], quantity: Math.min(Number(tok), 9) } } }
    }
    if (!found) {
      const hit = findTypo(lex, tok) ?? findTypo(lex, stemPhrase(tok))
      if (hit) found = { start: i, end: i + 1, text: tok, kind: hit.kind, hit, via: 'typo', confidence: CONFIDENCE.typo }
    }
    const m = found ?? { start: i, end: i + 1, text: tok, kind: 'unknown' as const, via: 'none' as const, confidence: 0 }
    out.push(m)
    i = m.end
  }
  return out
}
