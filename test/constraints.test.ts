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
    for (const f of src.filter((f) => /src\/(scene|parser|render|lexicon)\//.test(f))) expect(read(f), f).not.toMatch(/Math\.random/)
  })
  it('the parser, scene and renderer are pure: no DOM, no network, no storage', () => {
    for (const f of src.filter((f) => /src\/(scene|parser|lexicon)\//.test(f) || /src\/render\/(draw|jitter|prng|motion|svgRenderer)\.ts/.test(f))) {
      expect(read(f), f).not.toMatch(/\b(document|window|localStorage|sessionStorage|navigator|fetch|XMLHttpRequest|WebSocket|sendBeacon|indexedDB)\b/)
    }
  })
  it('no file makes a network request or loads remote code', () => {
    for (const f of src) expect(read(f), f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|import\(['"]https?:/)
  })
  it('the page cannot contact anything: a strict CSP is in place', () => {
    const html = read('index.html')
    expect(html).toContain("connect-src 'none'"); expect(html).toContain("default-src 'none'")
    expect(html).not.toMatch(/<script[^>]+src="https?:|<link[^>]+href="https?:|<img[^>]+src="https?:/)
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
})
