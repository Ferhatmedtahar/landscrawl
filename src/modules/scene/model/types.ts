export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'dusk' | 'night'
export type MoonPhase = 'none' | 'crescent' | 'half' | 'full'

export const TERRAINS = [
  // land forms
  'mountains', 'hills', 'dunes', 'plains', 'valley', 'cliffs', 'canyon', 'mesa', 'volcano',
  'tundra', 'glacier', 'savanna', 'swamp', 'beach', 'island',
  // water forms
  'sea', 'lake', 'river', 'waterfall', 'iceberg',
] as const
export type Terrain = (typeof TERRAINS)[number]

export const OBJECTS = [
  'cabin', 'house', 'village', 'boat', 'road', 'bridge', 'lighthouse', 'tent', 'campfire',
  'windmill', 'birds', 'balloon', 'person', 'hiker', 'fisherman', 'castle', 'casbah', 'mosque', 'camel',
  'igloo', 'pyramid', 'ruins', 'cactus', 'sled', 'penguins', 'whale',
] as const
export type SceneObject = (typeof OBJECTS)[number]

export interface Weather { clouds: number; rain: number; snow: number; fog: number; wind: number }
export interface Celestial { sun: boolean; moon: MoonPhase; stars: number; aurora: number; rainbow: number }
export interface Vegetation {
  forest: number; pine: number; palm: number; grass: number; flowers: number
  cactus: number; deadTrees: number; loneTree: boolean
}
export interface Palette { skyTint?: string; groundTint?: string; waterTint?: string; foliageTint?: string }
export interface Surface { snowCover: number }
export interface Mood { cozy: number; lonely: number; grand: number; spooky: number }
export interface Details { litWindows: boolean; smoke: boolean; reflection: boolean; fireflies: boolean }

export interface SceneState {
  time: TimeOfDay | null
  weather: Weather
  celestial: Celestial
  terrain: Terrain[]
  vegetation: Vegetation
  objects: SceneObject[]
  palette: Palette
  mood: Mood
  details: Details
  surface: Surface
  /** Size multipliers by trait key ("objects.village": 0.5 for "tiny village"). Missing = 1. */
  scale: Record<string, number>
  /** Explicit counts by trait key ("objects.boat": 2 for "two boats"). */
  counts: Record<string, number>
  /** Trait keys a word hints at but does not demand; the seed decides later ("coast" may add a lighthouse). */
  optional: string[]
  confidence: Record<string, number>
  unknownWords: string[]
  /** Understood words that had nothing to attach to (a colour with no noun, a stray "no"). */
  unusedWords: string[]
}

export function emptyScene(): SceneState {
  return {
    time: null,
    weather: { clouds: 0, rain: 0, snow: 0, fog: 0, wind: 0 },
    celestial: { sun: false, moon: 'none', stars: 0, aurora: 0, rainbow: 0 },
    terrain: [],
    vegetation: { forest: 0, pine: 0, palm: 0, grass: 0, flowers: 0, cactus: 0, deadTrees: 0, loneTree: false },
    objects: [],
    palette: {},
    mood: { cozy: 0, lonely: 0, grand: 0, spooky: 0 },
    details: { litWindows: false, smoke: false, reflection: false, fireflies: false },
    surface: { snowCover: 0 },
    scale: {},
    counts: {},
    optional: [],
    confidence: {},
    unknownWords: [],
    unusedWords: [],
  }
}

export interface PathSpec {
  d: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  /** Skip jitter and outline (stars, rain, snowflakes). */
  still?: boolean
  /** Force (true) or forbid (false) the double-line outline. Default: opaque hex fills get one. */
  outline?: boolean
  /** Outline colour; needed for gradient fills, which cannot derive one. */
  ink?: string
  /** Also fill with diagonal hatch lines (shadow sides). */
  hatch?: boolean
  /** Alternative shapes for animation, one per boil variant (variant % length). `d` must equal frames[0]. */
  frames?: string[]
}
export interface Layer {
  id: string
  /** Parallax depth: 0 = far/sky, 1 = near. Used from M4 on. */
  depth: number
  defs?: string
  paths: PathSpec[]
  /** Extra raw SVG markup drawn after the paths (used by the paper texture). */
  raw?: string
}

export const VIEW = { w: 1600, h: 900 } as const
