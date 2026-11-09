import { describe, expect, it } from 'vitest'
import { buildLexicon, rawLexicons, type Patch } from '../src/modules/lexicon'
import { emptyScene, OBJECTS, TERRAINS } from '../src/modules/scene/model/types'

function checkKey(key: string, value: unknown, where: string) {
  if (key.endsWith('+')) {
    const group = key.slice(0, -1)
    const allowed: readonly string[] = group === 'terrain' ? TERRAINS : group === 'objects' ? OBJECTS : []
    expect(allowed.length, `${where}: unknown list ${key}`).toBeGreaterThan(0)
    for (const v of value as string[]) expect(allowed, `${where}: "${v}" not in ${group}`).toContain(v)
    return
  }
  const scene = emptyScene() as unknown as Record<string, unknown>
  const [group, name] = key.split('.') as [string, string | undefined]
  if (!name) {
    expect(key, `${where}: top-level key`).toBe('time')
    expect(['dawn', 'day', 'sunset', 'dusk', 'night']).toContain(value)
    return
  }
  const sub = scene[group] as Record<string, unknown> | undefined
  expect(sub, `${where}: unknown group ${group}`).toBeDefined()
  if (group === 'palette') { expect(typeof value).toBe('string'); return }
  expect(name in (sub as object), `${where}: unknown trait ${key}`).toBe(true)
  const t = typeof (sub as Record<string, unknown>)[name]
  if (key === 'celestial.moon') expect(['none', 'crescent', 'half', 'full']).toContain(value)
  else expect(typeof value, `${where}: ${key} type`).toBe(t === 'string' ? 'string' : t)
}

describe('English lexicon', () => {
  const raw = rawLexicons.en!
  it('builds without duplicate keys', () => {
    expect(() => buildLexicon(raw)).not.toThrow()
  })
  it('every patch key and value is valid for SceneState', () => {
    for (const e of raw.traits) {
      const patches: Patch[] = [e.set, ...(e.single ? [e.single] : [])]
      for (const p of patches) for (const [k, v] of Object.entries(p)) checkKey(k, v, e.keys[0] as string)
      for (const m of e.maybe ?? []) {
        const [g, n] = m.split('.') as [string, string]
        const ok = g === 'objects' ? (OBJECTS as readonly string[]).includes(n) : n in ((emptyScene() as unknown as Record<string, Record<string, unknown>>)[g] ?? {})
        expect(ok, `maybe ${m}`).toBe(true)
      }
    }
  })
  it('every colour is a hex value', () => {
    for (const c of Object.values(raw.colors)) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('has a rich vocabulary', () => {
    const words = raw.traits.reduce((n, e) => n + e.keys.length, 0)
    expect(words).toBeGreaterThan(560)
  })
})
