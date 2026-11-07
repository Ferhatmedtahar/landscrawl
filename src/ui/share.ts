import type { Ratio } from '../render/svgRenderer'
import { RATIOS } from '../render/svgRenderer'

export interface ShareState { seed: number; text: string; lang: string; ratio: Ratio }

export const LANGUAGES = ['en'] as const
export const MAX_TEXT = 500
const MAX_SEED = 4294967295

/** `#s=<seed>&t=<text>&l=<lang>&r=<ratio>`: everything lives in the hash, so nothing reaches a server. */
export function encodeHash(s: ShareState): string {
  return `#s=${s.seed >>> 0}&t=${encodeURIComponent(s.text.slice(0, MAX_TEXT))}&l=${encodeURIComponent(s.lang)}&r=${encodeURIComponent(s.ratio)}`
}

/** Read a hash back. Anything missing or invalid falls back to `fallback`, never throws. */
export function decodeHash(hash: string, fallback: ShareState): ShareState {
  let p: URLSearchParams
  try { p = new URLSearchParams(hash.replace(/^#/, '')) } catch { return fallback }
  const rawSeed = p.get('s')
  const seed = rawSeed !== null && /^\d{1,10}$/.test(rawSeed) && Number(rawSeed) <= MAX_SEED ? Number(rawSeed) : fallback.seed
  const text = p.get('t') !== null ? (p.get('t') as string).slice(0, MAX_TEXT) : fallback.text
  const lang = (LANGUAGES as readonly string[]).includes(p.get('l') ?? '') ? (p.get('l') as string) : fallback.lang
  const r = p.get('r') ?? ''
  const ratio = (r in RATIOS ? r : fallback.ratio) as Ratio
  return { seed, text, lang, ratio }
}

export const hasHashState = (hash: string) => /(^|[#&])(s|t)=/.test(hash)
