import { noise2 } from '../scene/noise'

/**
 * Page background: contour lines of a smooth seeded height field (marching squares), like a relief map.
 * Pure and deterministic: the same options always give the same paths.
 */
export interface TopoOptions {
  width: number
  height: number
  seed: number
  /** Number of contour levels. */
  levels?: number
  /** Grid cell size in the same units as width and height. */
  cell?: number
}
export interface TopoLine {
  /** SVG path data for every line at this level. */
  d: string
  /** Every fourth level is drawn heavier, like index contours on a map. */
  major: boolean
}

type Pt = readonly [number, number]
/** Cell sides: 0 top, 1 right, 2 bottom, 3 left. */
type Side = 0 | 1 | 2 | 3

const MIN_POINTS = 6
const MAJOR_EVERY = 4

const fbm = (x: number, y: number, seed: number): number =>
  noise2(x * 0.0034, y * 0.0034, seed) * 0.6 +
  noise2(x * 0.0075 + 31, y * 0.0075 - 17, seed + 1) * 0.28 +
  noise2(x * 0.016, y * 0.016 + 9, seed + 2) * 0.12

/** For each marching-squares case (bits: top-left 8, top-right 4, bottom-right 2, bottom-left 1): the cell sides a segment joins. */
const SEGMENTS: Record<number, readonly (readonly [Side, Side])[]> = {
  1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[0, 3], [2, 1]], 6: [[0, 2]], 7: [[0, 3]],
  8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [3, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]],
}

const fmt = (n: number) => n.toFixed(1)
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const at = (p: Pt) => `${fmt(p[0])} ${fmt(p[1])}`

/** The height field sampled on a grid of (cols + 1) x (rows + 1) corners. */
class Grid {
  readonly cols: number
  readonly rows: number
  private readonly values: Float32Array

  constructor(width: number, height: number, readonly cell: number, seed: number) {
    this.cols = Math.ceil(width / cell) + 1
    this.rows = Math.ceil(height / cell) + 1
    this.values = new Float32Array((this.cols + 1) * (this.rows + 1))
    for (let j = 0; j <= this.rows; j++) for (let i = 0; i <= this.cols; i++) this.values[this.index(i, j)] = fbm(i * cell, j * cell, seed)
  }
  private index(i: number, j: number) { return j * (this.cols + 1) + i }
  value(i: number, j: number): number { return this.values[this.index(i, j)] ?? 0 }
  /** Unique id of a cell side: horizontal sides are even, vertical sides odd, shared by the two cells that touch it. */
  edge(i: number, j: number, side: Side): number {
    switch (side) {
      case 0: return this.index(i, j) * 2
      case 1: return this.index(i + 1, j) * 2 + 1
      case 2: return this.index(i, j + 1) * 2
      case 3: return this.index(i, j) * 2 + 1
    }
  }
  /** The two corners a side runs between. */
  corners(i: number, j: number, side: Side): readonly [readonly [number, number], readonly [number, number]] {
    switch (side) {
      case 0: return [[i, j], [i + 1, j]]
      case 1: return [[i + 1, j], [i + 1, j + 1]]
      case 2: return [[i, j + 1], [i + 1, j + 1]]
      case 3: return [[i, j], [i, j + 1]]
    }
  }
}

/** Connect marching-squares segments of one level into chains of side ids. */
interface Chain { ids: number[]; closed: boolean }

function contourChains(grid: Grid, level: number): { chains: Chain[]; points: Map<number, Pt> } {
  const points = new Map<number, Pt>()
  const links = new Map<number, number[]>()
  const link = (a: number, b: number) => {
    links.set(a, [...(links.get(a) ?? []), b])
    links.set(b, [...(links.get(b) ?? []), a])
  }
  const crossing = (i: number, j: number, side: Side): number => {
    const id = grid.edge(i, j, side)
    if (!points.has(id)) {
      const [[i0, j0], [i1, j1]] = grid.corners(i, j, side)
      const a = grid.value(i0, j0), b = grid.value(i1, j1), f = (level - a) / (b - a)
      points.set(id, [(i0 + (i1 - i0) * f) * grid.cell, (j0 + (j1 - j0) * f) * grid.cell])
    }
    return id
  }

  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      const code =
        (grid.value(i, j) >= level ? 8 : 0) | (grid.value(i + 1, j) >= level ? 4 : 0) |
        (grid.value(i + 1, j + 1) >= level ? 2 : 0) | (grid.value(i, j + 1) >= level ? 1 : 0)
      for (const [from, to] of SEGMENTS[code] ?? []) link(crossing(i, j, from), crossing(i, j, to))
    }
  }

  // open lines first (they start at a loose end), then whatever is left are closed loops
  const ids = [...links.keys()]
  const starts = [...ids.filter((id) => links.get(id)?.length === 1), ...ids]
  const seen = new Set<number>()
  const chains: Chain[] = []
  for (const start of starts) {
    if (seen.has(start)) continue
    const chain = [start]
    seen.add(start)
    let prev = -1, cur = start
    for (;;) {
      const next = (links.get(cur) ?? []).find((n) => n !== prev && !seen.has(n))
      if (next === undefined) break
      seen.add(next)
      chain.push(next)
      prev = cur
      cur = next
    }
    chains.push({ ids: chain, closed: chain.length > 2 && (links.get(cur) ?? []).includes(start) })
  }
  return { chains, points }
}

/** Smooth a polyline with quadratic curves through the midpoints of its segments. */
function smoothPath(pts: readonly Pt[], closed: boolean): string {
  const first = pts[0] as Pt, last = pts[pts.length - 1] as Pt
  let d = closed ? `M${at(mid(last, first))}` : `M${at(first)}`
  for (let n = closed ? 0 : 1; n < pts.length - 1; n++) d += `Q${at(pts[n] as Pt)} ${at(mid(pts[n] as Pt, pts[n + 1] as Pt))}`
  return d + (closed ? `Q${at(last)} ${at(mid(last, first))}Z` : `L${at(last)}`)
}

export function topoLines({ width, height, seed, levels = 18, cell = 14 }: TopoOptions): TopoLine[] {
  const grid = new Grid(width, height, cell, seed)
  const lines: TopoLine[] = []
  for (let k = 0; k < levels; k++) {
    const level = -0.5 + (k + 0.5) / levels
    const { chains, points } = contourChains(grid, level)
    const d = chains
      .filter((c) => c.ids.length >= MIN_POINTS)
      .map((c) => smoothPath(c.ids.map((id) => points.get(id) as Pt), c.closed))
      .join('')
    if (d) lines.push({ d, major: k % MAJOR_EVERY === 0 })
  }
  return lines
}

export const topoSvg = (opts: TopoOptions): string =>
  topoLines(opts).map((l) => `<path class="${l.major ? 'major' : 'minor'}" d="${l.d}"/>`).join('')
