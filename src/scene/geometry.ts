import { mulberry32, subSeed } from '../render/prng'
import type { Resolved } from './resolve'
import { VIEW } from './types'

export type Pt = readonly [number, number]
/** Where the far land meets the ground. */
export const HORIZON = 560

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

export function polyline(pts: readonly Pt[], close = false): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${f1(p[0])} ${f1(p[1])}`).join('') + (close ? 'Z' : '')
}

/** Smooth closed curve through points (Catmull-Rom converted to cubic Beziers). */
export function smoothClosed(pts: readonly Pt[]): string {
  const n = pts.length
  const at = (i: number) => pts[((i % n) + n) % n] as Pt
  let d = `M${f1(at(0)[0])} ${f1(at(0)[1])}`
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`
  }
  return d + 'Z'
}

export function circlePath(cx: number, cy: number, r: number): string {
  return `M${f1(cx - r)} ${f1(cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx + r)} ${f1(cy)}A${f1(r)} ${f1(r)} 0 1 0 ${f1(cx - r)} ${f1(cy)}Z`
}

export type Profile = ((x: number) => number) & { peakX?: number }
export const STEP = 8
/** Ridges and ground run this far past both edges so parallax never shows a seam. */
export const EDGE = 64

export function samples(profile: Profile, step = STEP): Pt[] {
  const out: Pt[] = []
  for (let x = -EDGE; x <= VIEW.w + EDGE; x += step) out.push([x, profile(x)])
  return out
}

/** Filled polygon under a profile, down to `bottom`. */
export function areaBelow(profile: Profile, bottom: number = VIEW.h + 40): string {
  const pts = samples(profile)
  return polyline(pts) + `L${VIEW.w + EDGE} ${bottom}L${-EDGE} ${bottom}Z`
}

export interface WaterGeo {
  sea?: { top: number }
  lake?: { cx: number; cy: number; rx: number; ry: number; pts: Pt[] }
  river?: { pts: { x: number; y: number; w: number }[] }
}

/** Water shapes are computed once and shared by drawing and (later) object placement. */
export function waterGeometry(r: Resolved, seed: number): WaterGeo {
  const rng = mulberry32(subSeed(seed, 'water'))
  const [a, b, c, d, e] = [rng(), rng(), rng(), rng(), rng()] as [number, number, number, number, number]
  const geo: WaterGeo = {}
  if (r.waters.includes('sea')) geo.sea = { top: HORIZON + 24 }
  if (r.waters.includes('lake')) {
    const cx = 480 + a * 640, cy = 690 + b * 50, rx = 300 + c * 200, ry = 70 + d * 36
    const n = 28
    const pts: Pt[] = []
    const lr = mulberry32(subSeed(seed, 'lake-shape'))
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2
      const wob = 1 + (lr() - 0.5) * 0.16
      pts.push([cx + Math.cos(t) * rx * wob, cy + Math.sin(t) * ry * wob])
    }
    geo.lake = { cx, cy, rx, ry, pts }
  }
  if (r.waters.includes('river')) {
    const x0 = 560 + e * 480, amp = 90 + a * 110, ph = b * 6
    const pts: { x: number; y: number; w: number }[] = []
    for (let y = HORIZON + 10; y <= VIEW.h + 20; y += 20) {
      const t = (y - HORIZON) / (VIEW.h - HORIZON)
      pts.push({ x: x0 + Math.sin(t * 5 + ph) * amp * (0.3 + t) + (t - 0.3) * 120 * (c - 0.5), y, w: 8 + t * t * 190 })
    }
    geo.river = { pts }
  }
  return geo
}

/** True when (x, y) is in open water. Conservative near edges so objects never sit on a shore line. */
export function inWater(g: WaterGeo, x: number, y: number): boolean {
  if (g.sea && y >= g.sea.top) return true
  if (g.lake) {
    const dx = (x - g.lake.cx) / (g.lake.rx * 1.02), dy = (y - g.lake.cy) / (g.lake.ry * 1.05)
    if (dx * dx + dy * dy <= 1) return true
  }
  if (g.river) {
    for (const p of g.river.pts) if (Math.abs(p.y - y) < 12 && Math.abs(p.x - x) < p.w / 2 + 6) return true
  }
  return false
}
