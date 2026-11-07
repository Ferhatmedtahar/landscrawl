/** Pure helpers for the boil, settle and draw-in behaviour, so they can be tested without a browser. */

export const VARIANTS = 4
/** Jitter in scene units (the scene is 1600 wide, so about 1 px on screen at ~0.6 scale). */
export const AMP_ACTIVE = 2.6
export const AMP_SETTLED = 1.1
export const SETTLE_MS = 600
export const BOIL_MS = 140
export const DRAW_IN_MS = 400
export const FADE_OUT_MS = 350

export function ampFor(msSinceInput: number): number {
  return msSinceInput >= SETTLE_MS ? AMP_SETTLED : AMP_ACTIVE
}

export function nextVariant(v: number): number {
  return (v + 1) % VARIANTS
}

export interface LayerDiff { added: string[]; removed: string[]; kept: string[] }

export function diffLayers(prev: string[], next: string[]): LayerDiff {
  const p = new Set(prev), n = new Set(next)
  return { added: next.filter((id) => !p.has(id)), removed: prev.filter((id) => !n.has(id)), kept: next.filter((id) => p.has(id)) }
}

/** Parallax offset in scene units for a layer, given the pointer offset (-1..1). Near layers move most. */
export function parallax(depth: number, px: number, py: number): { x: number; y: number } {
  const max = 24
  return { x: -px * max * depth, y: -py * max * 0.35 * depth }
}
