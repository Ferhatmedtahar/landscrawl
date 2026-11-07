import { mulberry32, subSeed } from '../render/prng'
import { makeNoise1D } from './noise'
import { STEP, type Profile, type Pt, polyline, samples } from './geometry'
import { VIEW } from './types'

export type ProfileKind = 'mountains' | 'hills' | 'dunes' | 'mesa' | 'volcano' | 'glacier' | 'flat' | 'valley'

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A ridge line: y = f(x). Lower y is higher on screen, `amp` is the tallest rise above `base`. */
export function makeProfile(kind: ProfileKind, seed: number, base: number, amp: number): Profile {
  const n = makeNoise1D(seed, kind === 'hills' || kind === 'flat' ? 3 : 5)
  const fine = makeNoise1D(subSeed(seed, 'fine'), 3)
  switch (kind) {
    case 'mountains':
    case 'glacier': {
      const round = kind === 'glacier' ? 1.3 : 2
      return (x) => {
        const v = Math.min(1, Math.abs(n(x * 0.0042) * 1.7))
        return base - amp * (Math.pow(1 - v, round) * 0.95 + 0.05) + fine(x * 0.02) * amp * 0.05
      }
    }
    case 'hills':
      return (x) => base - amp * (0.5 + 0.5 * n(x * 0.0032)) + fine(x * 0.01) * amp * 0.06
    case 'flat':
      return (x) => base - amp * (0.5 + 0.5 * n(x * 0.002))
    case 'valley':
      return (x) => {
        const edge = Math.abs(x - VIEW.w / 2) / (VIEW.w / 2)
        return base - amp * (0.15 + 0.85 * ss(0.15, 0.95, edge)) * (0.8 + 0.2 * (n(x * 0.004) + 1) / 2)
      }
    case 'dunes': {
      const heights = makeNoise1D(subSeed(seed, 'dune-h'), 2)
      return (x) => {
        const u = x * 0.0042 + n(x * 0.0015) * 0.7
        const i = Math.floor(u), t = u - i
        const a = 0.55 + 0.45 * heights(i + 0.5)
        // gentle windward slope, sharp crest, steeper lee side
        const shape = t < 0.68 ? Math.pow(ss(0, 0.68, t), 1.15) : 1 - ss(0.68, 0.8, t) * 0.78
        return base - amp * (0.18 + 0.82 * shape * a)
      }
    }
    case 'mesa':
      return (x) => {
        const v = n(x * 0.0036)
        const h = ss(-0.28, -0.12, v) * 0.4 + ss(-0.04, 0.08, v) * 0.35 + ss(0.14, 0.27, v) * 0.25
        return base - amp * h + fine(x * 0.03) * 4
      }
    case 'volcano': {
      const rng = mulberry32(subSeed(seed, 'volcano-x'))
      const x0 = VIEW.w * (0.3 + 0.4 * rng())
      const half = VIEW.w * 0.3
      const prof: Profile = (x) => {
        const rolling = base - amp * 0.22 * (0.5 + 0.5 * n(x * 0.003))
        const d = Math.abs(x - x0)
        if (d >= half) return rolling
        const cone = base - amp * 1.25 * Math.pow(1 - d / half, 0.85)
        const crater = d < 34 ? 16 * (1 - d / 34) : 0 // notch at the top
        return Math.min(rolling, cone + crater)
      }
      prof.peakX = x0
      return prof
    }
  }
}

export interface Peak { x: number; y: number; vx: number; vy: number }

/** Local summits with the valley to their right (for the shadow side). */
export function findPeaks(profile: Profile, minRise: number): Peak[] {
  const pts = samples(profile)
  const peaks: Peak[] = []
  const R = 5
  for (let i = R; i < pts.length - R; i++) {
    const y = (pts[i] as Pt)[1]
    let top = true
    for (let k = 1; k <= R && top; k++) if ((pts[i - k] as Pt)[1] < y || (pts[i + k] as Pt)[1] < y) top = false
    if (!top) continue
    let j = i
    while (j + 1 < pts.length && (pts[j + 1] as Pt)[1] >= (pts[j] as Pt)[1]) j++
    const rise = (pts[j] as Pt)[1] - y
    if (rise >= minRise) peaks.push({ x: (pts[i] as Pt)[0], y, vx: (pts[j] as Pt)[0], vy: (pts[j] as Pt)[1] })
  }
  return peaks
}

/** Darker polygon on the right-hand slope of each peak: the cheap way to get faceted, lit mountains. */
export function shadowFacets(profile: Profile, minRise: number, reach = 0.8): string[] {
  return findPeaks(profile, minRise).map((p) => {
    const slope: Pt[] = []
    for (let x = p.x; x <= p.vx; x += STEP) slope.push([x, profile(x)])
    const base = p.vy
    const inner: Pt[] = [
      [p.vx, base],
      [p.x + (p.vx - p.x) * 0.5, base - (base - p.y) * (1 - reach) - 6],
      [p.x + (p.vx - p.x) * 0.1, p.y + (base - p.y) * reach * 0.8],
    ]
    return polyline([...slope, ...inner], true)
  })
}

/** Snow polygons hugging the summits above a snow line, with a ragged lower edge. */
export function snowCaps(profile: Profile, snowLine: number, maxDepth: number, seed: number): string[] {
  const jag = makeNoise1D(subSeed(seed, 'snow-jag'), 3)
  const pts = samples(profile)
  const caps: string[] = []
  let run: Pt[] = []
  const flush = () => {
    if (run.length > 2) {
      const lower: Pt[] = [...run].reverse().map(([x, y]) => {
        const depth = Math.min(maxDepth, (snowLine - y) * 0.95) * (0.55 + 0.45 * jag(x * 0.05))
        return [x, y + Math.max(2, depth)] as Pt
      })
      caps.push(polyline([...run, ...lower], true))
    }
    run = []
  }
  for (const p of pts) {
    if (p[1] < snowLine) run.push(p)
    else flush()
  }
  flush()
  return caps
}
