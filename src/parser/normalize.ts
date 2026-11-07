/** Token that separates clauses (commas, periods, ...). Negation and attachment never cross it. */
export const BOUNDARY = '|'

/** Lowercase, strip accents, turn punctuation into clause boundaries, drop symbols. Keeps any script's letters. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:!?()[\]{}"“”\n\r\t]+/g, ` ${BOUNDARY} `)
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}| ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Very small English stemmer: plurals only. "mountains"->"mountain", "beaches"->"beach", "ponies"->"pony". */
export function stem(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y'
  if (/(ss|us|is)$/.test(word)) return word
  if (/(xes|ches|shes|sses)$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}

export function stemPhrase(phrase: string): string {
  return phrase.split(' ').map(stem).join(' ')
}

/** Optimal-string-alignment distance: insert, delete, substitute and adjacent swap each cost 1. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1, cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
    }
  }
  return d[rows - 1]![cols - 1]!
}
