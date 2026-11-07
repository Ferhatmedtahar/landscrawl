import { BOUNDARY, normalizeText } from './normalize'

export interface Token {
  /** Normalised word (lowercase, no accents) or BOUNDARY. */
  text: string
  /** Character range in the original text. */
  start: number
  end: number
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
const BREAK = /[.,;:!?()[\]{}"“”\n\r\t|]/

/** Words with their positions in the original text, plus a boundary token wherever punctuation separates them. */
export function tokenizeSpans(text: string): Token[] {
  const out: Token[] = []
  let prevEnd = 0
  for (const m of text.matchAll(WORD)) {
    const start = m.index ?? 0
    const norm = normalizeText(m[0])
    if (norm === '') continue
    if (out.length > 0 && BREAK.test(text.slice(prevEnd, start))) out.push({ text: BOUNDARY, start: prevEnd, end: start })
    out.push({ text: norm, start, end: start + m[0].length })
    prevEnd = start + m[0].length
  }
  return out
}

export function tokenize(text: string): string[] {
  return tokenizeSpans(text).map((t) => t.text)
}
