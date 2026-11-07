import { getLexicon, type Patch, type PatchValue, type TraitEntry } from '../lexicon'
import { emptyScene, type SceneState } from '../scene/types'
import type { Match } from './match'
import { scan } from './match'
import { attachColors, attachModifiers, nextTrait } from './modifiers'
import { resolveNegations } from './negation'
import { tokenizeSpans, type Token } from './tokenize'

/** Plain mentions ("rain", "fog") are written at 0.6 in the lexicon; "heavy" (0.9) scales them by 1.5, "light" (0.3) by 0.5. */
const BASELINE = 0.6

interface Op {
  /** Trait key, e.g. "weather.rain", "terrain.mountains", "time". */
  key: string
  /** Identity used for negation and soft/hard bookkeeping (time and moon are by value or slot). */
  id: string
  kind: 'set' | 'add'
  value?: number | boolean | string
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function opsOf(patch: Patch, level?: number): Op[] {
  const ops: Op[] = []
  for (const [k, v] of Object.entries(patch)) {
    if (k.endsWith('+')) {
      const list = k.slice(0, -1)
      for (const name of v as string[]) ops.push({ key: `${list}.${name}`, id: `${list}.${name}`, kind: 'add', value: name })
    } else {
      let value: PatchValue = v
      if (typeof value === 'number' && level !== undefined) value = clamp01((value * level) / BASELINE)
      const id = k === 'time' ? `time=${String(value)}` : k
      ops.push({ key: k, id, kind: 'set', value: value as number | boolean | string })
    }
  }
  return ops
}

/** First key of an entry: what size, count and optional hints are attached to. */
function primaryKey(entry: TraitEntry): string | undefined {
  const first = opsOf(entry.set)[0]
  return first?.key
}

function getAt(state: SceneState, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], state)
}
function setAt(state: SceneState, path: string, value: unknown): void {
  const parts = path.split('.')
  const last = parts.pop() as string
  const parent = parts.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], state) as Record<string, unknown>
  parent[last] = value
}

function applyOp(state: SceneState, op: Op, negate: boolean): void {
  if (op.kind === 'add') {
    const [list] = op.key.split('.') as ['terrain' | 'objects']
    const arr = state[list] as string[]
    const name = op.value as string
    if (negate) {
      const i = arr.indexOf(name)
      if (i >= 0) arr.splice(i, 1)
    } else if (!arr.includes(name)) arr.push(name)
    return
  }
  const v = op.value
  if (op.key === 'time') {
    if (negate) { if (state.time === v) state.time = null } else state.time = v as SceneState['time']
  } else if (op.key === 'celestial.moon') {
    setAt(state, op.key, negate ? 'none' : v)
  } else if (op.key.startsWith('palette.')) {
    if (!negate) setAt(state, op.key, v)
  } else if (typeof v === 'number') {
    setAt(state, op.key, negate ? 0 : v)
  } else if (typeof v === 'boolean') {
    setAt(state, op.key, negate ? false : v)
  } else {
    setAt(state, op.key, v)
  }
}

/** Ids that negation tracks: a whole slot for the moon, a specific value for time. */
const negationId = (op: Op) => (op.key === 'celestial.moon' ? 'celestial.moon' : op.id)

/** A recognised thing the user can see and remove: a trait with its modifiers and colour. */
export interface Chip {
  label: string
  /** Character range in the original text covering the trait and what is attached to it. */
  start: number
  end: number
}

export interface Parsed { state: SceneState; chips: Chip[] }

export function parse(text: string, lang = 'en'): SceneState {
  return parseDetailed(text, lang).state
}

export function parseDetailed(text: string, lang = 'en'): Parsed {
  const lex = getLexicon(lang)
  const state = emptyScene()
  const tokens: Token[] = tokenizeSpans(text)
  const matches = scan(tokens.map((t) => t.text), lex)
  resolveNegations(matches)
  attachModifiers(matches)
  attachColors(matches)

  const negated = new Set<string>()
  const explicit = new Set<string>()
  const confidence = (id: string, c: number) => { state.confidence[id] = Math.max(state.confidence[id] ?? 0, c) }

  matches.forEach((m, i) => {
    if (m.kind === 'unknown') {
      if (!state.unknownWords.includes(m.text)) state.unknownWords.push(m.text)
      return
    }
    const note = (w: string) => { if (!state.unusedWords.includes(w)) state.unusedWords.push(w) }
    if (m.kind === 'negator' && m.used === false) note(m.text)
    if (m.kind === 'modifier' && !m.attached) note(m.text)

    if (m.kind === 'color' && m.hit?.kind === 'color') {
      const j = nextTrait(matches, i)
      const target = j >= 0 ? (matches[j] as Match) : undefined
      const tint = target?.hit?.kind === 'trait' ? target.hit.entry.tint : undefined
      if (!tint || target?.negated) { note(m.text); return }
      const op: Op = { key: `palette.${tint}`, id: `palette.${tint}`, kind: 'set', value: m.hit.color }
      if (!negated.has(op.id)) { applyOp(state, op, false); explicit.add(op.key); confidence(op.id, m.confidence) }
      return
    }

    if (m.kind !== 'trait' || m.hit?.kind !== 'trait') return
    const entry = m.hit.entry
    const patch = m.quantity === 1 && entry.single ? entry.single : entry.set
    const ops = opsOf(patch, m.level)
    const soft = entry.soft === true

    for (const op of ops) {
      const id = negationId(op)
      if (m.negated) {
        applyOp(state, op, true)
        negated.add(id)
        confidence(id, 1)
        continue
      }
      if (negated.has(id)) continue
      if (soft && explicit.has(op.key)) continue
      applyOp(state, op, false)
      if (!soft) explicit.add(op.key)
      confidence(id, m.confidence)
    }

    if (m.negated) return
    const key = primaryKey(entry)
    if (key) {
      const size = m.scale ?? entry.scale
      if (size !== undefined) state.scale[key] = size
      if (m.quantity !== undefined) state.counts[key] = m.quantity
    }
    for (const k of entry.maybe ?? []) if (!state.optional.includes(k)) state.optional.push(k)
  })

  // Drop hints the text already settled or negated.
  state.optional = state.optional.filter((k) => !negated.has(k) && !hasTrait(state, k))

  const chips: Chip[] = []
  matches.forEach((m, i) => {
    if (m.kind !== 'trait' || m.negated || m.hit?.kind !== 'trait' || Object.keys(m.hit.entry.set).length === 0) return
    let first = m.start
    matches.forEach((o) => { if (o.target === i && o.attached) first = Math.min(first, o.start) })
    const start = (tokens[first] as Token).start, end = (tokens[m.end - 1] as Token).end
    chips.push({ label: text.slice(start, end), start, end })
  })
  return { state, chips }
}

function hasTrait(state: SceneState, key: string): boolean {
  const [group, name] = key.split('.') as [string, string]
  if (group === 'objects' || group === 'terrain') return (state[group] as string[]).includes(name)
  const v = getAt(state, key)
  return typeof v === 'number' ? v > 0 : v === true
}
