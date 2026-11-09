import { mulberry32, subSeed } from '../render/prng'
import type { MoonPhase, Palette, SceneObject, SceneState, Terrain, TimeOfDay, Vegetation, Weather } from './types'

export type WaterKind = 'sea' | 'lake' | 'river'
export type Surface = 'grass' | 'sand' | 'snow' | 'rock' | 'marsh'

/** SceneState with every "not mentioned" filled in from the seed. Pure and stable. */
export interface ResolvedObject { kind: SceneObject; count: number; scale: number }

export interface Resolved {
  seed: number
  time: TimeOfDay
  weather: Weather
  sun: boolean
  moon: MoonPhase
  stars: number
  aurora: number
  rainbow: number
  terrain: Terrain[]
  /** The main land form drawn behind everything. */
  backdrop: Terrain
  waters: WaterKind[]
  iceberg: boolean
  waterfall: boolean
  beach: boolean
  cliffs: boolean
  surface: Surface
  snowCover: number
  palette: Palette
  grass: number
  flowers: number
  vegetation: Vegetation
  objects: ResolvedObject[]
  spooky: number
  smoke: boolean
  reflection: boolean
  fireflies: boolean
  state: SceneState
}

const DEFAULT_COUNT: Partial<Record<SceneObject, number>> = { birds: 6, camel: 2, penguins: 4 }

const BACKDROP_PRIORITY: Terrain[] = ['volcano', 'canyon', 'mesa', 'mountains', 'glacier', 'dunes', 'hills', 'valley', 'tundra', 'savanna', 'swamp', 'plains', 'cliffs']

export function resolveScene(state: SceneState, seed: number): Resolved {
  const rng = mulberry32(subSeed(seed, 'resolve'))
  // Draw every random number up front so unrelated words never reshuffle the defaults.
  const [rTime, rTerrain, rLake, rCloud, rMoon, rBackdrop, rVeg, rVeg2] = [rng(), rng(), rng(), rng(), rng(), rng(), rng(), rng()] as [number, number, number, number, number, number, number, number]
  const said = (key: string) => state.confidence[key] !== undefined
  const pick = <T,>(list: readonly T[], r: number) => list[Math.min(list.length - 1, Math.floor(r * list.length))] as T

  const timePool: TimeOfDay[] = state.celestial.sun ? ['dawn', 'day', 'day', 'sunset'] : ['dawn', 'day', 'day', 'sunset', 'sunset', 'dusk', 'night']
  // fireflies need the dark: when no time is said, the seed picks dusk or night
  const time = state.time ?? (state.details.fireflies ? pick<TimeOfDay>(['dusk', 'night', 'night'], rTime) : pick(timePool, rTime))

  let terrain = [...state.terrain]
  if (terrain.length === 0) {
    terrain = [pick<Terrain>(['mountains', 'hills', 'plains'], rTerrain)]
    if (rLake < 0.5) terrain.push('lake')
  }
  const has = (t: Terrain) => terrain.includes(t)
  const backdrop = BACKDROP_PRIORITY.find(has) ?? pick<Terrain>(['hills', 'mountains'], rBackdrop)
  const waters: WaterKind[] = (['sea', 'lake', 'river'] as const).filter(has)

  const weather: Weather = { ...state.weather }
  if (!said('weather.clouds')) weather.clouds = Math.round((0.1 + 0.4 * rCloud) * 100) / 100

  const stars = said('celestial.stars') ? state.celestial.stars : ({ night: 0.8, dusk: 0.35, dawn: 0.12, sunset: 0, day: 0 } as const)[time]
  const overcast = weather.clouds >= 0.85 || weather.rain > 0.5 || weather.snow > 0.7
  const sun = time !== 'night' && !overcast && (state.celestial.sun || (!said('celestial.sun') && (time === 'day' || time === 'dawn' || time === 'sunset')))
  let moon: MoonPhase = state.celestial.moon
  if (!said('celestial.moon')) moon = time === 'night' ? pick<MoonPhase>(['crescent', 'half', 'full', 'full'], rMoon) : 'none'
  if (overcast) moon = 'none'

  const snowCover = Math.max(state.surface.snowCover, backdrop === 'glacier' ? 0.6 : 0, has('tundra') ? 0.3 : 0)
  const surface: Surface = snowCover >= 0.55 ? 'snow' : has('dunes') ? 'sand' : has('swamp') ? 'marsh' : has('mesa') || has('canyon') ? 'rock' : 'grass'
  const grass = said('vegetation.grass') ? state.vegetation.grass : surface === 'grass' ? 0.45 : 0.05

  // Hints like "sahara may have a camel": the seed decides, once, per hint.
  const realised = state.optional.filter((k) => mulberry32(subSeed(seed, `opt:${k}`))() < 0.5)
  const veg: Vegetation = { ...state.vegetation }
  let aurora = state.celestial.aurora
  const extraObjects: SceneObject[] = []
  for (const k of realised) {
    const [group, name] = k.split('.') as [string, string]
    if (group === 'vegetation' && typeof veg[name as keyof Vegetation] === 'number' && !said(k)) (veg as unknown as Record<string, number>)[name] = 0.3
    else if (group === 'objects') extraObjects.push(name as SceneObject)
    else if (k === 'celestial.aurora' && !said(k) && (time === 'night' || time === 'dusk')) aurora = 0.6
  }
  // Nothing said about plants: the seed plants a few that suit the ground.
  const noPlants = !said('vegetation.forest') && !said('vegetation.pine') && !said('vegetation.palm') && !said('vegetation.cactus') && !said('vegetation.deadTrees') && !state.vegetation.loneTree
  if (noPlants && veg.forest + veg.pine + veg.palm + veg.cactus + veg.deadTrees === 0) {
    if (surface === 'snow') veg.pine = 0.15 + rVeg * 0.3
    else if (surface === 'sand') { if (rVeg < 0.5) veg.cactus = 0.2 }
    else if (surface === 'marsh') veg.deadTrees = 0.3 + rVeg * 0.2
    else if (surface === 'rock') { if (rVeg < 0.5) veg.cactus = 0.2 }
    else if (backdrop === 'mountains' && rVeg2 < 0.6) veg.pine = 0.2 + rVeg * 0.35
    else veg.forest = rVeg * 0.45
  }
  const kinds: SceneObject[] = [...state.objects]
  for (const k of extraObjects) if (!kinds.includes(k)) kinds.push(k)
  const objects: ResolvedObject[] = kinds.map((kind) => ({
    kind,
    count: Math.max(1, Math.round(state.counts[`objects.${kind}`] ?? DEFAULT_COUNT[kind] ?? 1)),
    scale: state.scale[`objects.${kind}`] ?? 1,
  }))

  return {
    seed, time, weather, sun, moon, stars, aurora, rainbow: state.celestial.rainbow, terrain, backdrop, waters,
    iceberg: has('iceberg'), waterfall: has('waterfall'), beach: has('beach'), cliffs: has('cliffs'),
    surface, snowCover, palette: state.palette, grass, flowers: state.vegetation.flowers, vegetation: veg, objects,
    spooky: state.mood.spooky, smoke: state.details.smoke, reflection: state.details.reflection, fireflies: state.details.fireflies, state,
  }
}
