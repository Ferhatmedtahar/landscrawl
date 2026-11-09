import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}
const src = files('src').filter((f) => f.endsWith('.ts'))
const read = (f: string) => readFileSync(f, 'utf8')

describe('project constraints', () => {
  it('scene generation never uses Math.random (everything comes from the seeded PRNG)', () => {
    for (const f of src.filter((f) => /src\/modules\/(shared|scene|parser|render|stage|lexicon)\//.test(f))) expect(read(f), f).not.toMatch(/Math\.random/)
  })
  it('the parser, scene and renderer are pure: no DOM, no network, no storage', () => {
    for (const f of src.filter((f) => /src\/modules\/(shared|scene|parser|lexicon|render)\//.test(f) || /src\/modules\/stage\/motion\.ts/.test(f))) {
      expect(read(f), f).not.toMatch(/\b(document|window|localStorage|sessionStorage|navigator|fetch|XMLHttpRequest|WebSocket|sendBeacon|indexedDB)\b/)
    }
  })
  it('no file makes a network request or loads remote code', () => {
    for (const f of src) expect(read(f), f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|import\(['"]https?:/)
  })
  it('the page cannot contact anything: a strict CSP is in place', () => {
    const html = read('index.html'), config = read('vite.config.ts')
    expect(html).toContain('<!--csp-->'); expect(config).toContain("connect-src 'none'"); expect(config).toContain("default-src 'none'")
    expect(html).not.toMatch(/<script[^>]+src="https?:|<link(?![^>]*rel="canonical")[^>]+href="https?:|<img[^>]+src="https?:/)
  })
  it('no analytics, trackers or AI/model calls are referenced anywhere', () => {
    for (const f of [...src, 'index.html', 'package.json']) expect(read(f), f).not.toMatch(/google-analytics|gtag|plausible|segment\.|mixpanel|openai|anthropic|api\.[a-z]+\.com/i)
  })
  it('no runtime dependencies', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([])
  })
  it('licences are in place', () => {
    expect(read('LICENSE')).toContain('MIT License'); expect(read('LICENSE-ASSETS')).toContain('CC0')
  })

  it('modules only depend downwards: shared < lexicon < scene < parser, render < stage < ui < main', () => {
    // allowed imports for each module (a module may always import itself)
    const ALLOWED: Record<string, string[]> = {
      shared: [],
      lexicon: ['shared'],
      scene: ['shared'],
      parser: ['shared', 'lexicon', 'scene'],
      render: ['shared', 'scene'],
      stage: ['shared', 'scene', 'render'],
      ui: ['shared', 'lexicon', 'scene', 'parser', 'render', 'stage'],
      main: ['shared', 'lexicon', 'scene', 'parser', 'render', 'stage', 'ui'],
    }
    const moduleOf = (path: string) => (path.startsWith('src/modules/') ? path.split('/')[2] ?? '' : 'main').replace(/\.ts$/, '')
    let checked = 0
    for (const f of src) {
      const me = moduleOf(f)
      expect(ALLOWED[me], `unknown module folder src/${me}`).toBeDefined()
      for (const m of read(f).matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]*)['"]/g)) {
        const target = join(f, '..', m[1] as string).replace(/\\/g, '/')
        const dep = moduleOf(target)
        checked++
        if (dep !== me) expect(ALLOWED[me], `${f} imports ${m[1]}: ${me} must not depend on ${dep}`).toContain(dep)
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
  it('scene sub-modules keep their order: model < layout < style < art < layers', () => {
    const ORDER = ['model', 'layout', 'style', 'art', 'layers']
    const sub = (p: string) => ORDER.indexOf(p.split('/')[3] ?? '')
    for (const f of src.filter((f) => f.startsWith('src/modules/scene/') && sub(f) >= 0)) {
      for (const m of read(f).matchAll(/from\s+['"](\.[^'"]*)['"]/g)) {
        const target = join(f, '..', m[1] as string).replace(/\\/g, '/')
        if (target.startsWith('src/modules/scene/') && sub(target) >= 0) expect(sub(target), `${f} imports ${m[1]}`).toBeLessThanOrEqual(sub(f))
      }
    }
  })
})
