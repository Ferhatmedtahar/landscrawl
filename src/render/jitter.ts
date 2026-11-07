import { noise2 } from '../scene/noise'
import { mulberry32 } from './prng'

export type Pt = [number, number]
export interface Poly { pts: Pt[]; closed: boolean }

const r1 = (n: number) => Math.round(n * 10) / 10
const NUM = /([MmLlHhVvCcQqAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gi
const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 }

function arcPoints(x1: number, y1: number, rxIn: number, ryIn: number, rot: number, large: number, sweep: number, x2: number, y2: number, maxSeg: number): Pt[] {
  if (x1 === x2 && y1 === y2) return []
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn)
  if (rx === 0 || ry === 0) return [[x2, y2]]
  const phi = (rot * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi)
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && dt > 0) dt -= Math.PI * 2
  else if (sweep && dt < 0) dt += Math.PI * 2
  const arcLen = Math.abs(dt) * Math.max(rx, ry)
  const n = Math.max(4, Math.min(48, Math.ceil(arcLen / maxSeg)))
  const out: Pt[] = []
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n
    const x = rx * Math.cos(t), y = ry * Math.sin(t)
    out.push([cp * x - sp * y + cx, sp * x + cp * y + cy])
  }
  out[out.length - 1] = [x2, y2]
  return out
}

/** Parse an SVG path (M L H V C Q A Z, absolute and relative) into short straight pieces. */
export function flatten(d: string, maxSeg = 16): Poly[] {
  const tokens: (string | number)[] = []
  for (const m of d.matchAll(NUM)) tokens.push(m[1] ?? Number(m[2]))
  const polys: Poly[] = []
  let cur: Poly | undefined
  let cx = 0, cy = 0, sx = 0, sy = 0
  let cmd = ''
  let i = 0
  const lineTo = (x: number, y: number) => {
    if (!cur) return
    const dist = Math.hypot(x - cx, y - cy)
    const n = Math.max(1, Math.ceil(dist / maxSeg))
    for (let k = 1; k <= n; k++) cur.pts.push([cx + ((x - cx) * k) / n, cy + ((y - cy) * k) / n])
    cx = x; cy = y
  }
  const next = () => tokens[i++] as number
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++] as string
    const up = cmd.toUpperCase(), rel = cmd !== up
    if (up === 'Z') {
      if (cur) { cur.closed = true; cx = sx; cy = sy }
      continue
    }
    const need = ARGS[up]
    if (need === undefined || i + need > tokens.length) break
    const ox = rel ? cx : 0, oy = rel ? cy : 0
    if (up === 'M') {
      cx = next() + ox; cy = next() + oy; sx = cx; sy = cy
      cur = { pts: [[cx, cy]], closed: false }
      polys.push(cur)
      cmd = rel ? 'l' : 'L'
    } else if (up === 'L') lineTo(next() + ox, next() + oy)
    else if (up === 'H') lineTo(next() + ox, cy)
    else if (up === 'V') lineTo(cx, next() + oy)
    else if (up === 'C') {
      const x1 = next() + ox, y1 = next() + oy, x2 = next() + ox, y2 = next() + oy, x = next() + ox, y = next() + oy
      const n = Math.max(2, Math.min(28, Math.ceil((Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2)) / maxSeg)))
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t
        cur?.pts.push([u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y])
      }
      cx = x; cy = y
    } else if (up === 'Q') {
      const x1 = next() + ox, y1 = next() + oy, x = next() + ox, y = next() + oy
      const n = Math.max(2, Math.min(20, Math.ceil((Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x - x1, y - y1)) / maxSeg)))
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t
        cur?.pts.push([u * u * cx + 2 * u * t * x1 + t * t * x, u * u * cy + 2 * u * t * y1 + t * t * y])
      }
      cx = x; cy = y
    } else if (up === 'A') {
      const rx = next(), ry = next(), rot = next(), large = next(), sweep = next(), x = next() + ox, y = next() + oy
      for (const p of arcPoints(cx, cy, rx, ry, rot, large, sweep, x, y, maxSeg)) cur?.pts.push(p)
      cx = x; cy = y
    }
  }
  return polys
}

/** Offset every point by smooth noise (long wobble) plus a little per-point shake. */
export function jitterPolys(polys: Poly[], seed: number, amp: number): Poly[] {
  const rng = mulberry32(seed)
  const s1 = seed | 0, s2 = (seed * 31 + 7) | 0
  return polys.map((p) => ({
    closed: p.closed,
    pts: p.pts.map(([x, y]) => [
      x + noise2(x * 0.04, y * 0.04, s1) * amp + (rng() - 0.5) * amp * 0.35,
      y + noise2(x * 0.04 + 31.7, y * 0.04 + 11.3, s2) * amp + (rng() - 0.5) * amp * 0.35,
    ] as Pt),
  }))
}

export function polysToD(polys: Poly[]): string {
  let d = ''
  for (const p of polys) {
    p.pts.forEach(([x, y], i) => { d += `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}` })
    if (p.closed) d += 'Z'
  }
  return d
}
