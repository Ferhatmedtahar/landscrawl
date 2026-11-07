import { normalizeText } from './normalize'

export function tokenize(text: string): string[] {
  const n = normalizeText(text)
  return n === '' ? [] : n.split(' ')
}
