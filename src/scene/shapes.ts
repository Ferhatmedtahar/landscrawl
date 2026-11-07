import { mulberry32 } from '../render/prng'
import { circlePath, f1, polyline, smoothClosed, type Pt } from './geometry'
import { mix, shade } from './color'
import type { Pal } from './palette'
import type { PlacedObject, PlacedTree } from './placement'
import type { Resolved } from './resolve'
import type { PathSpec } from './types'

/** Draws in local units around a feet point (0, 0), y up is negative, scaled by s. */
class Ctx {
  constructor(public x: number, public y: number, public s: number, public out: PathSpec[], private tint: (hex: string) => string) {}
  c = (hex: string) => this.tint(hex)
  p = ([px, py]: Pt): Pt => [this.x + px * this.s, this.y + py * this.s]
  poly(pts: Pt[], fill: string, extra: Partial<PathSpec> = {}) { this.out.push({ d: polyline(pts.map(this.p), true), fill: this.c(fill), ...extra }) }
  blob(pts: Pt[], fill: string, extra: Partial<PathSpec> = {}) { this.out.push({ d: smoothClosed(pts.map(this.p)), fill: this.c(fill), ...extra }) }
  line(pts: Pt[], stroke: string, w: number, extra: Partial<PathSpec> = {}) { this.out.push({ d: polyline(pts.map(this.p)), stroke: this.c(stroke), strokeWidth: Math.max(1, w * this.s), ...extra }) }
  curve(a: Pt, ctrl: Pt, b: Pt, stroke: string, w: number) {
    const [ax, ay] = this.p(a), [cx, cy] = this.p(ctrl), [bx, by] = this.p(b)
    this.out.push({ d: `M${f1(ax)} ${f1(ay)}Q${f1(cx)} ${f1(cy)} ${f1(bx)} ${f1(by)}`, stroke: this.c(stroke), strokeWidth: Math.max(1, w * this.s) })
  }
  dot(cx: number, cy: number, rad: number, fill: string, extra: Partial<PathSpec> = {}) { const [x, y] = this.p([cx, cy]); this.out.push({ d: circlePath(x, y, rad * this.s), fill: fill.startsWith('url') ? fill : this.c(fill), ...extra }) }
  rect(x0: number, y0: number, x1: number, y1: number, fill: string, extra: Partial<PathSpec> = {}) { this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill, extra) }
}

export interface Glow { x: number; y: number; r: number; kind: 'warm' | 'cool' | 'fire' }
export interface Drawn { paths: PathSpec[]; glows: Glow[]; beams: { x: number; y: number; dir: 1 | -1; len: number }[] }

const DARK: Record<string, number> = { night: 1, dusk: 0.8, dawn: 0.4, sunset: 0.35, day: 0 }
export const darkness = (time: string) => DARK[time] ?? 0

function trunk(c: Ctx, w: number, h: number, color = '#6b4a32') {
  c.poly([[-w, 0], [-w * 0.7, -h], [w * 0.7, -h], [w, 0]], color, { outline: false })
}

export function drawTree(t: PlacedTree, r: Resolved, pal: Pal, out: PathSpec[]): void {
  const rng = mulberry32(t.seed)
  const haze = Math.max(0, 1 - (t.y - 610) / 270) * 0.3
  const c = new Ctx(t.x, t.y, t.s, out, (h) => pal.lit(h, haze))
  const tintFol = (base: string) => (r.palette.foliageTint ? mix(base, r.palette.foliageTint, 0.65) : base)
  const snow = r.snowCover > 0.3
  const sw = pal.lit('#f4f8fb', haze)
  const far = t.s < 0.55 && !t.lone

  if (t.kind === 'pine') {
    const g = tintFol('#2f6b4a')
    trunk(c, 4, 18)
    const tiers = 3 + (rng() < 0.5 ? 1 : 0)
    let shadeD = '', snowD = ''
    for (let i = 0; i < tiers; i++) {
      const w = 34 - i * 6, top = -32 - i * 26 - 38, base = -28 - i * 26
      c.poly([[-w, base], [0, top], [w, base]], i % 2 ? shade(g, 0.9) : g, { outline: !far })
      shadeD += polyline([c.p([0, top]), c.p([w, base]), c.p([w * 0.1, base])], true)
      const k = base - (base - top) * 0.45
      if (snow) snowD += polyline([c.p([-w * 0.55, k]), c.p([0, top]), c.p([w * 0.55, k]), c.p([w * 0.2, base - (base - top) * 0.38]), c.p([-w * 0.1, base - (base - top) * 0.5]), c.p([-w * 0.3, base - (base - top) * 0.36])], true)
    }
    out.push({ d: shadeD, fill: '#10281c', opacity: 0.25, outline: false })
    if (snowD) out.push({ d: snowD, fill: sw, outline: false })
  } else if (t.kind === 'leaf') {
    const g = tintFol('#5a9a4a')
    trunk(c, 5, 34)
    c.blob([[-40, -44], [-30, -84], [0, -104], [34, -86], [44, -48], [18, -30], [-18, -30]], shade(g, 0.88), { outline: !far })
    c.blob([[-30, -56], [-22, -86], [2, -98], [26, -82], [32, -58], [4, -46]], g, { outline: false })
    c.blob([[-12, -72], [2, -92], [20, -82], [14, -64]], mix(g, '#ffffff', 0.18), { outline: false })
  } else if (t.kind === 'palm') {
    const lean = (rng() - 0.5) * 30
    const trunkPts: Pt[] = [[0, 0], [lean * 0.3, -40], [lean * 0.8, -80], [lean, -120]]
    c.line(trunkPts, '#8a6a46', 9, { outline: false })
    c.line(trunkPts, '#6b4e32', 3)
    const g = tintFol('#4f9a55')
    const n = 8
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.3
      const len = 58 + rng() * 14
      const ex = lean + Math.cos(a) * len, ey = -120 + Math.sin(a) * len * 0.45 + Math.abs(Math.cos(a)) * 26
      const mx = lean + Math.cos(a) * len * 0.5, my = -120 + Math.sin(a) * len * 0.45 - 20
      c.poly([[lean, -122], [mx, my - 12], [ex, ey], [mx + 2, my + 12]], i % 2 ? g : shade(g, 0.85), { outline: !far })
    }
    c.dot(lean, -118, 4, '#5a4032'); c.dot(lean + 6, -114, 3.4, '#5a4032')
  } else if (t.kind === 'dead') {
    const wood = '#5b4a40'
    trunk(c, 5, 80, wood)
    const branch = (bx: number, by: number, ang: number, len: number, depth: number) => {
      if (depth === 0 || len < 8) return
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len
      c.line([[bx, by], [ex, ey]], wood, depth * 1.8)
      branch(ex, ey, ang - 0.5 - rng() * 0.3, len * 0.66, depth - 1)
      branch(ex, ey, ang + 0.5 + rng() * 0.3, len * 0.62, depth - 1)
    }
    branch(0, -78, -Math.PI / 2 - 0.9, 34, 3); branch(0, -78, -Math.PI / 2 + 0.9, 32, 3); branch(0, -50, -Math.PI / 2 + 1.1, 24, 2)
    if (snow) c.line([[-4, -80], [4, -80]], '#f4f8fb', 5, { outline: false })
  } else {
    const g = tintFol('#5f9a5a')
    const arm = (side: number) => c.line([[side * 4, -34], [side * 20, -34], [side * 22, -62]], g, 11, { outline: false })
    c.line([[0, 0], [0, -84]], g, 15, { outline: false })
    arm(-1); arm(1)
    c.line([[-5, -4], [-5, -80]], shade(g, 0.78), 2.5)
    c.line([[5, -4], [5, -80]], mix(g, '#ffffff', 0.2), 2)
  }
}

// ---- objects -------------------------------------------------------------------------------

function windowFill(lit: boolean) { return lit ? '#ffd66b' : '#5d6b7a' }

function houseLike(c: Ctx, r: Resolved, pal: Pal, rng: () => number, kind: 'cabin' | 'house', glows: Glow[], tone?: number) {
  const lit = r.state.details.litWindows
  const wall = kind === 'cabin' ? '#8a5a3a' : mix('#d9c7a8', '#e8b98a', tone ?? rng() * 0.5)
  const roof = kind === 'cabin' ? '#5a3a2a' : mix('#a8483a', '#6d4a8a', (tone ?? rng()) * 0.4)
  const w = kind === 'cabin' ? 46 : 54, h = kind === 'cabin' ? 44 : 54
  c.rect(-w, -h, w, 0, wall)
  if (kind === 'cabin') for (let i = 1; i < 4; i++) c.line([[-w, -h + i * 11], [w, -h + i * 11]], '#5a3a26', 1.6, { opacity: 0.6 })
  c.poly([[-w - 10, -h], [0, -h - 38], [w + 10, -h]], roof)
  c.poly([[0, -h - 38], [w + 10, -h], [2, -h]], '#000000', { opacity: 0.2, outline: false })
  if (r.snowCover > 0.3) c.poly([[-w - 10, -h], [0, -h - 38], [w + 10, -h], [w + 2, -h - 4], [0, -h - 30], [-w - 2, -h - 4]], '#f4f8fb', { outline: false })
  c.rect(w * 0.45, -h - 34, w * 0.45 + 10, -h - 10, '#6d5a4c')
  c.rect(-w * 0.8, -h * 0.5 - 8, -w * 0.3, -h * 0.5 + 12, windowFill(lit), { outline: true })
  c.line([[-w * 0.55, -h * 0.5 - 8], [-w * 0.55, -h * 0.5 + 12]], '#3a2a20', 1.5)
  c.rect(w * 0.05, -h * 0.58, w * 0.5, 0, '#3f2a1e')
  if (lit) {
    const [gx, gy] = c.p([-w * 0.55, -h * 0.5 + 2])
    glows.push({ x: gx, y: gy, r: 46 * c.s, kind: 'warm' })
  }
  if (r.smoke) {
    const [sx, sy] = [w * 0.45 + 5, -h - 38]
    for (let i = 0; i < 4; i++) c.dot(sx + i * 6 + rng() * 4, sy - i * 14, 5 + i * 2.5, '#d8dde6', { opacity: 0.6 - i * 0.1, outline: false })
  }
}

function boat(c: Ctx, glows: Glow[], night: number, reflect: boolean) {
  if (reflect) c.poly([[-34, 6], [34, 6], [26, 20], [-26, 20]], '#14202e', { opacity: 0.3, outline: false })
  c.poly([[-38, -8], [38, -8], [26, 6], [-26, 6]], '#7a4a32')
  c.line([[0, -8], [0, -88]], '#4a3322', 3)
  c.poly([[3, -86], [36, -16], [3, -16]], '#f4efe3')
  c.poly([[-3, -78], [-30, -18], [-3, -18]], '#ead9b8')
  if (night > 0.3) { c.dot(0, -92, 3, '#ffd66b', { outline: false }); const [gx, gy] = c.p([0, -92]); glows.push({ x: gx, y: gy, r: 34 * c.s, kind: 'warm' }) }
}

function camel(c: Ctx) {
  const col = '#b8875a'
  c.line([[-22, -22], [-22, 0]], shade(col, 0.8), 6); c.line([[-8, -22], [-8, 0]], shade(col, 0.8), 6)
  c.line([[12, -22], [12, 0]], shade(col, 0.8), 6); c.line([[26, -22], [26, 0]], shade(col, 0.8), 6)
  c.blob([[-34, -30], [-26, -46], [-14, -42], [-4, -54], [8, -44], [30, -42], [36, -30], [20, -20], [-18, -20]], col)
  c.line([[32, -38], [44, -58], [54, -62]], col, 9, { outline: false })
  c.blob([[48, -66], [62, -64], [62, -56], [48, -56]], col)
}

function drawObject(o: PlacedObject, r: Resolved, pal: Pal, glows: Glow[], beams: Drawn['beams'], out: PathSpec[]): void {
  const rng = mulberry32(o.seed)
  const haze = Math.max(0, 1 - (o.y - 610) / 270) * 0.28
  const c = new Ctx(o.x, o.y, o.s, out, (h) => pal.lit(h, haze))
  const dark = darkness(r.time)
  switch (o.kind) {
    case 'cabin': houseLike(c, r, pal, rng, 'cabin', glows); break
    case 'house': houseLike(c, r, pal, rng, 'house', glows); break
    case 'village': {
      const n = 5 + Math.floor(rng() * 3)
      for (let i = 0; i < n; i++) {
        const ox = (i - (n - 1) / 2) * 38 + (rng() - 0.5) * 12, oy = (i % 2) * -8 + rng() * 6, sc = 0.5 + rng() * 0.18
        const sub = new Ctx(c.x + ox * c.s * 1.3, c.y + oy * c.s, c.s * sc * 1.25, out, (h) => pal.lit(h, haze))
        houseLike(sub, r, pal, rng, rng() < 0.4 ? 'cabin' : 'house', glows, rng())
      }
      break
    }
    case 'boat': boat(c, glows, dark, r.reflection || dark < 0.5); break
    case 'tent': {
      const sandy = r.surface === 'sand'
      const cloth = sandy ? '#4a3a30' : '#c8553d'
      if (sandy) { c.poly([[-60, 0], [-48, -34], [48, -34], [60, 0]], cloth); c.poly([[-48, -34], [0, -46], [48, -34]], shade(cloth, 1.2)); c.poly([[-14, 0], [-10, -26], [10, -26], [14, 0]], '#1a120e') }
      else { c.poly([[-46, 0], [0, -62], [46, 0]], cloth); c.poly([[0, -62], [46, 0], [4, 0]], shade(cloth, 0.78), { outline: false }); c.poly([[-12, 0], [0, -34], [12, 0]], '#2a1a14'); c.line([[0, -62], [0, -74]], '#4a3322', 2.4) }
      break
    }
    case 'campfire': {
      c.line([[-16, -2], [14, -9]], '#5a3a26', 6); c.line([[16, -2], [-14, -9]], '#4a3020', 6)
      c.poly([[-12, -8], [-6, -34], [0, -18], [6, -42], [13, -8]], '#ff8a2e')
      c.poly([[-6, -8], [0, -26], [7, -8]], '#ffd24a', { outline: false })
      const [gx, gy] = c.p([0, -20]); glows.push({ x: gx, y: gy, r: (54 + dark * 40) * c.s, kind: 'fire' })
      break
    }
    case 'windmill': {
      c.poly([[-24, 0], [-14, -92], [14, -92], [24, 0]], '#e8dcc4')
      c.poly([[-18, -92], [0, -118], [18, -92]], '#8a4a3a')
      c.rect(-6, -26, 6, 0, '#5a3a2a')
      const ang = rng() * Math.PI
      for (let i = 0; i < 4; i++) {
        const a = ang + (i * Math.PI) / 2
        const ex = Math.cos(a) * 64, ey = -100 + Math.sin(a) * 64
        c.line([[0, -100], [ex, ey]], '#6b4e32', 3.5)
        const nx = -Math.sin(a) * 12, ny = Math.cos(a) * 12
        c.poly([[Math.cos(a) * 16, -100 + Math.sin(a) * 16], [ex, ey], [ex + nx, ey + ny], [Math.cos(a) * 16 + nx, -100 + Math.sin(a) * 16 + ny]], '#f0e6d0', { opacity: 0.92 })
      }
      c.dot(0, -100, 5, '#4a3322')
      break
    }
    case 'birds': {
      let d = ''
      for (let i = 0; i < 1; i++) { const [x, y] = c.p([0, 0]); const w = 12 * c.s; d += `M${f1(x - w)} ${f1(y)}q${f1(w / 2)} ${f1(-w * 0.8)} ${f1(w)} 0q${f1(w / 2)} ${f1(-w * 0.8)} ${f1(w)} 0` }
      out.push({ d, stroke: dark > 0.5 ? '#aab4d0' : '#2a2a38', strokeWidth: 2.2, still: false })
      break
    }
    case 'castle': {
      const st = '#9a9aa6'
      c.rect(-40, -80, 40, 0, st); c.rect(-62, -110, -36, 0, shade(st, 0.92)); c.rect(36, -110, 62, 0, shade(st, 0.92)); c.rect(-14, -120, 14, -80, shade(st, 1.05))
      for (const [x0, x1, y] of [[-62, -36, -110], [36, 62, -110], [-14, 14, -120]] as const) for (let k = 0; k < 3; k++) c.rect(x0 + k * ((x1 - x0) / 3), y - 9, x0 + k * ((x1 - x0) / 3) + (x1 - x0) / 6, y, st)
      c.poly([[-12, 0], [-12, -26], [0, -36], [12, -26], [12, 0]], '#2a2430')
      c.line([[0, -129], [0, -150]], '#4a3322', 2); c.poly([[0, -150], [16, -144], [0, -138]], '#c8423b', { outline: false })
      for (const wx of [-50, 50, 0]) c.rect(wx - 3, wx === 0 ? -108 : -90, wx + 3, wx === 0 ? -98 : -78, windowFill(r.state.details.litWindows))
      break
    }
    case 'casbah': {
      const n = 6
      for (let i = 0; i < n; i++) {
        const x0 = -90 + i * 30 + rng() * 6, hh = 34 + rng() * 40, ww = 26 + rng() * 6, yy = -((i % 3) * 8)
        const wall = mix('#e8d6b0', '#d8b988', rng() * 0.5)
        c.rect(x0, yy - hh, x0 + ww, yy, wall)
        c.poly([[x0 + ww, yy - hh], [x0 + ww + 6, yy - hh + 4], [x0 + ww + 6, yy + 4], [x0 + ww, yy]], shade(wall, 0.8), { outline: false })
        c.poly([[x0 + 7, yy], [x0 + 7, yy - 14], [x0 + ww / 2, yy - 22], [x0 + ww - 7, yy - 14], [x0 + ww - 7, yy]], '#3a2a20')
        if (rng() < 0.6) c.rect(x0 + ww / 2 - 3, yy - hh + 8, x0 + ww / 2 + 3, yy - hh + 16, windowFill(r.state.details.litWindows))
      }
      c.blob([[-14, -76], [-10, -92], [4, -98], [18, -92], [20, -76]], '#f0e4c8')
      break
    }
    case 'mosque': {
      c.rect(-54, -50, 54, 0, '#efe6d2'); c.poly([[-54, -50], [-40, -62], [40, -62], [54, -50]], '#dfd2b8')
      c.blob([[-34, -62], [-30, -92], [0, -108], [30, -92], [34, -62]], '#5fa3a0')
      c.line([[0, -108], [0, -124]], '#d9b44a', 2.4); c.dot(0, -126, 4, '#d9b44a')
      c.rect(60, -118, 72, 0, '#efe6d2'); c.poly([[58, -118], [66, -136], [74, -118]], '#5fa3a0'); c.line([[66, -136], [66, -148]], '#d9b44a', 2)
      for (const x of [-34, -10, 14, 36]) c.poly([[x, 0], [x, -20], [x + 8, -28], [x + 16, -20], [x + 16, 0]], '#4a4036')
      break
    }
    case 'camel': {
      for (let i = 0; i < 1; i++) camel(c)
      break
    }
    case 'igloo': {
      c.blob([[-52, 0], [-50, -26], [-30, -52], [0, -62], [30, -52], [50, -26], [52, 0]], '#e8f2f8')
      for (let k = 1; k < 4; k++) c.curve([-52 + k * 9, -k * 13 + 2], [0, -66 + k * 17], [52 - k * 9, -k * 13 + 2], '#a9c4d6', 1.5)
      c.poly([[-18, 0], [-18, -18], [0, -28], [18, -18], [18, 0]], '#2a3a50')
      break
    }
    case 'pyramid': {
      c.poly([[-90, 0], [-6, -100], [6, -100], [10, 0]], '#e6c98a'); c.poly([[0, -104], [96, 0], [10, 0]], '#c7a263')
      for (let k = 1; k < 5; k++) c.line([[-90 + k * 14, -k * 18], [90 - k * 14, -k * 18]], '#a88548', 1.2, { opacity: 0.5 })
      break
    }
    case 'ruins': {
      const st = '#b8aa96'
      c.rect(-80, -8, 80, 0, shade(st, 0.9))
      for (let i = 0; i < 4; i++) {
        const x = -64 + i * 40, h = 40 + rng() * 40
        c.poly([[x - 9, -8], [x - 9, -h], [x - 3, -h - 6 - rng() * 8], [x + 4, -h + 2], [x + 9, -h - 4], [x + 9, -8]], st)
        c.rect(x - 11, -14, x + 11, -8, shade(st, 0.95))
      }
      c.poly([[-60, -40], [-40, -60], [-20, -40], [-26, -40], [-40, -54], [-54, -40]], st)
      break
    }
    case 'sled': {
      c.curve([-34, 4], [-44, 6], [-38, -8], '#5a3a26', 3.5); c.curve([34, 4], [44, 6], [38, -8], '#5a3a26', 3.5)
      c.line([[-34, 3], [34, 3]], '#5a3a26', 3.5)
      c.poly([[-30, -4], [30, -4], [26, -20], [-26, -20]], '#a8483a'); c.blob([[-14, -20], [-8, -32], [10, -32], [16, -20]], '#d9c7a8')
      break
    }
    case 'penguins': {
      for (let i = 0; i < 1; i++) {
        c.blob([[-8, 0], [-12, -22], [-6, -38], [6, -38], [12, -22], [8, 0]], '#1f2430')
        c.blob([[-5, -2], [-7, -20], [-3, -32], [3, -32], [7, -20], [5, -2]], '#f4f6f8', { outline: false })
        c.poly([[-2, -33], [6, -31], [-2, -29]], '#f0a030', { outline: false })
        c.poly([[-8, 0], [-2, 0], [-4, 4]], '#f0a030', { outline: false }); c.poly([[2, 0], [8, 0], [4, 4]], '#f0a030', { outline: false })
      }
      break
    }
    case 'whale': {
      c.blob([[-80, 8], [-60, -14], [-10, -34], [40, -26], [74, -4], [80, 8]], '#46607a')
      c.poly([[-70, -6], [-96, -30], [-84, -34], [-66, -20]], '#3a5068')
      c.line([[-30, -34], [-34, -66]], '#e9f4fb', 3.5, { outline: false }); c.line([[-30, -34], [-14, -60]], '#e9f4fb', 3.5, { outline: false })
      c.line([[-96, 10], [96, 10]], '#dff1fb', 2.4, { opacity: 0.7 })
      break
    }
    case 'lighthouse': {
      if (o.onIslet) c.blob([[-60, 8], [-46, -14], [-14, -22], [24, -16], [58, 8]], '#6a6670')
      const y0 = o.onIslet ? -14 : 0
      c.poly([[-22, y0], [-14, y0 - 100], [14, y0 - 100], [22, y0]], '#f4f0e8')
      c.poly([[-19, y0 - 28], [-16, y0 - 46], [16, y0 - 46], [19, y0 - 28]], '#c8423b', { outline: false })
      c.poly([[-16, y0 - 66], [-14, y0 - 82], [14, y0 - 82], [16, y0 - 66]], '#c8423b', { outline: false })
      c.rect(-20, y0 - 104, 20, y0 - 100, '#3a3a46')
      c.rect(-11, y0 - 122, 11, y0 - 104, dark > 0.2 ? '#ffe9a0' : '#cfe0ea')
      c.poly([[-14, y0 - 122], [0, y0 - 138], [14, y0 - 122]], '#3a3a46')
      if (dark > 0.2) {
        const [gx, gy] = c.p([0, y0 - 113]); glows.push({ x: gx, y: gy, r: 70 * c.s, kind: 'warm' })
        beams.push({ x: gx, y: gy, dir: rng() < 0.5 ? 1 : -1, len: 520 * c.s })
      }
      break
    }
    case 'bridge': {
      const x1 = o.x, x2 = o.x2 ?? o.x, y = o.y
      const wood = pal.lit('#8a6a46', 0.1), dk = pal.lit('#5a4430', 0.1)
      if (r.waters.includes('sea') && x1 === x2) {
        out.push({ d: polyline([[x1 - 16 * o.s, y], [x1 + 16 * o.s, y], [x1 + 8 * o.s, y - 130 * o.s], [x1 - 8 * o.s, y - 130 * o.s]], true), fill: wood })
        for (let k = 1; k < 8; k++) out.push({ d: polyline([[x1 - (16 - k) * o.s, y - k * 16 * o.s], [x1 + (16 - k) * o.s, y - k * 16 * o.s]]), stroke: dk, strokeWidth: 1.6 })
      } else {
        const hw = (r.waters.includes('river') && x1 === x2 ? (o.seed + 50) / 2 : Math.abs(x2 - x1) / 2) + 20
        const cx = (x1 + x2) / 2, th = 10 * o.s
        out.push({ d: polyline([[cx - hw, y - th], [cx + hw, y - th], [cx + hw, y + th * 0.4], [cx - hw, y + th * 0.4]], true), fill: wood })
        out.push({ d: `M${f1(cx - hw * 0.6)} ${f1(y + th * 0.4)}Q${f1(cx)} ${f1(y - th * 1.2)} ${f1(cx + hw * 0.6)} ${f1(y + th * 0.4)}`, stroke: dk, strokeWidth: 2.4 })
        for (let k = 0; k <= 6; k++) { const px = cx - hw + (k * 2 * hw) / 6; out.push({ d: `M${f1(px)} ${f1(y - th)}v${f1(-18 * o.s)}`, stroke: dk, strokeWidth: 2.4 }) }
        out.push({ d: `M${f1(cx - hw)} ${f1(y - th - 18 * o.s)}H${f1(cx + hw)}`, stroke: dk, strokeWidth: 2.4 })
      }
      break
    }
    default: break
  }
}

export function drawObjects(objs: PlacedObject[], r: Resolved, pal: Pal): Drawn {
  const paths: PathSpec[] = [], glows: Glow[] = [], beams: Drawn['beams'] = []
  for (const o of [...objs].sort((a, b) => a.y - b.y)) drawObject(o, r, pal, glows, beams, paths)
  return { paths, glows, beams }
}

export function drawTrees(trees: PlacedTree[], r: Resolved, pal: Pal): PathSpec[] {
  const out: PathSpec[] = []
  for (const t of trees) drawTree(t, r, pal, out)
  return out
}

/** Spare "unused" helper kept for callers that only need a circle path of a glow. */
export const glowPath = circlePath
