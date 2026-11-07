import { mulberry32, subSeed } from '../render/prng'
import type { MoonPhase, Palette, SceneState, Terrain, TimeOfDay, Weather } from './types'

export type WaterKind = 'sea' | 'lake' | 'river'
export type Surface = 'grass' | 'sand' | 'snow' | 'rock' | 'marsh'

/** SceneState with every "not mentioned" filled in from the seed. Pure and stable. */
export interface Resolved {
  seed: number
  time: TimeOfDay
  weather: Weather
  sun: boolean
  moon: MoonPhase
  stars: number
  aurora: number
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
  spooky: number
  smoke: boolean
  reflection: boolean
  state: SceneState
}

const BACKDROP_PRIORITY: Terrain[] = ['volcano', 'canyon', 'mesa', 'mountains', 'glacier', 'dunes', 'hills', 'valley', 'tundra', 'savanna', 'swamp', 'plains', 'cliffs']

export function resolveScene(state: SceneState, seed: number): Resolved {
  const rng = mulberry32(subSeed(seed, 'resolve'))
  // Draw every random number up front so unrelated words never reshuffle the defaults.
  const [rTime, rTerrain, rLake, rCloud, rMoon, rBackdrop] = [rng(), rng(), rng(), rng(), rng(), rng()] as [number, number, number, number, number, number]
  const said = (key: string) => state.confidence[key] !== undefined
  const pick = <T,>(list: readonly T[], r: number) => list[Math.min(list.length - 1, Math.floor(r * list.length))] as T

  const timePool: TimeOfDay[] = state.celestial.sun ? ['dawn', 'day', 'day', 'sunset'] : ['dawn', 'day', 'day', 'sunset', 'sunset', 'dusk', 'night']
  const time = state.time ?? pick(timePool, rTime)

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

  const snowCover = Math.max(state.surface.snowCover, backdrop === 'glacier' ? 0.5 : 0, has('tundra') ? 0.3 : 0)
  const surface: Surface = snowCover >= 0.55 ? 'snow' : has('dunes') ? 'sand' : has('swamp') ? 'marsh' : has('mesa') || has('canyon') ? 'rock' : 'grass'
  const grass = said('vegetation.grass') ? state.vegetation.grass : surface === 'grass' ? 0.45 : 0.05

  return {
    seed, time, weather, sun, moon, stars, aurora: state.celestial.aurora, terrain, backdrop, waters,
    iceberg: has('iceberg'), waterfall: has('waterfall'), beach: has('beach'), cliffs: has('cliffs'),
    surface, snowCover, palette: state.palette, grass, flowers: state.vegetation.flowers,
    spooky: state.mood.spooky, smoke: state.details.smoke, reflection: state.details.reflection, state,
  }
}
