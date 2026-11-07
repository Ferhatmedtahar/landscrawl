import { editDistance, normalizeText, stemPhrase } from '../parser/normalize'
import en from './lexicon.en.json'

export type PatchValue = number | boolean | string | string[]
export type Patch = Record<string, PatchValue>

export interface TraitEntry {
  keys: string[]
  set: Patch
  /** Used instead of `set` for "one"/"a single"/"lone". */
  single?: Patch
  /** Archetype or mood word: fills gaps but never overrides what the text said explicitly. */
  soft?: boolean
  /** Which palette slot a colour word in front of this noun paints. */
  tint?: 'skyTint' | 'groundTint' | 'waterTint' | 'foliageTint'
  /** Default size multiplier ("pond" is a small lake). */
  scale?: number
  /** Trait keys the seed may add later. */
  maybe?: string[]
}
export interface ModifierEntry { keys: string[]; level?: number; scale?: number; quantity?: number }
export interface RawLexicon {
  lang: string
  stopwords: string[]
  connectors: string[]
  negators: string[]
  modifiers: ModifierEntry[]
  colors: Record<string, string>
  traits: TraitEntry[]
}

export type Hit =
  | { kind: 'trait'; entry: TraitEntry }
  | { kind: 'modifier'; entry: ModifierEntry }
  | { kind: 'color'; color: string }
  | { kind: 'negator' }
  | { kind: 'connector' }
  | { kind: 'stop' }

export interface Lexicon {
  lang: string
  exact: Map<string, Hit>
  stemmed: Map<string, Hit>
  /** Single-word keys of 5+ letters, sorted, for typo matching. */
  typoKeys: { key: string; hit: Hit }[]
}

export function buildLexicon(raw: RawLexicon): Lexicon {
  const exact = new Map<string, Hit>()
  const stemmed = new Map<string, Hit>()
  const add = (key: string, hit: Hit) => {
    const k = normalizeText(key)
    if (exact.has(k)) throw new Error(`lexicon ${raw.lang}: duplicate key "${k}"`)
    exact.set(k, hit)
    const s = stemPhrase(k)
    if (!stemmed.has(s)) stemmed.set(s, hit)
  }
  for (const w of raw.stopwords) if (!exact.has(normalizeText(w))) add(w, { kind: 'stop' })
  for (const w of raw.connectors) add(w, { kind: 'connector' })
  for (const w of raw.negators) add(w, { kind: 'negator' })
  for (const m of raw.modifiers) for (const k of m.keys) add(k, { kind: 'modifier', entry: m })
  for (const [k, color] of Object.entries(raw.colors)) add(k, { kind: 'color', color })
  for (const t of raw.traits) for (const k of t.keys) add(k, { kind: 'trait', entry: t })

  const typoKeys: { key: string; hit: Hit }[] = []
  for (const [key, hit] of [...exact, ...stemmed]) {
    // Typos are only forgiven for content words, never for stopwords or negators.
    if (key.length >= 5 && !key.includes(' ') && (hit.kind === 'trait' || hit.kind === 'color' || hit.kind === 'modifier')) typoKeys.push({ key, hit })
  }
  typoKeys.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return { lang: raw.lang, exact, stemmed, typoKeys }
}

const LEXICONS: Record<string, Lexicon> = {}
/** The raw JSON of every registered language, for validation tests and tools. */
export const rawLexicons: Record<string, RawLexicon> = {}

/** Add a language. To ship one: drop `lexicon.<code>.json` here, register it below, add UI strings in ui/i18n.ts. */
export function registerLexicon(raw: RawLexicon): void {
  LEXICONS[raw.lang] = buildLexicon(raw)
  rawLexicons[raw.lang] = raw
}

registerLexicon(en as unknown as RawLexicon)

export const languages = (): string[] => Object.keys(LEXICONS)

export function getLexicon(lang: string): Lexicon {
  return LEXICONS[lang] ?? (LEXICONS.en as Lexicon)
}

/** Typo rule: 5+ letters, same first letter, edit distance 1 (a swap counts as 1). First alphabetical wins on ties. */
export function findTypo(lex: Lexicon, word: string): Hit | undefined {
  if (word.length < 5) return undefined
  for (const c of lex.typoKeys) {
    if (c.key[0] !== word[0] || Math.abs(c.key.length - word.length) > 1) continue
    if (editDistance(c.key, word) === 1) return c.hit
  }
  return undefined
}
