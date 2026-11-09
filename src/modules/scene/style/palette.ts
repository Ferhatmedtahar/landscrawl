import { clamp01, mix, shade } from '../../shared/color'
import type { Resolved } from '../model/resolve'
import type { TimeOfDay } from '../model/types'

interface TimeLook {
  /** Sky stops: top, middle, horizon. */
  sky: [string, string, string]
  /** Colour of the light that washes over the land. */
  light: string
  /** How strongly that light tints the land (0-1). */
  k: number
  /** Overall brightness multiplier for the land. */
  b: number
  /** What cloud/rain greying moves the sky toward. */
  grey: string
}

const TIME: Record<TimeOfDay, TimeLook> = {
  dawn:   { sky: ['#5d6fb0', '#e6a6ac', '#fbd9a8'], light: '#ffc8a0', k: 0.22, b: 0.9, grey: '#a9a6b8' },
  day:    { sky: ['#3f86d4', '#79b6e8', '#cfe9f7'], light: '#fff6df', k: 0.08, b: 1, grey: '#a5b0bc' },
  sunset: { sky: ['#3c2f6e', '#c8587a', '#ffb070'], light: '#ff9a5a', k: 0.34, b: 0.82, grey: '#9a7e8e' },
  dusk:   { sky: ['#1b2150', '#5a4a8e', '#d88a9c'], light: '#8a6aa8', k: 0.3, b: 0.58, grey: '#5a5878' },
  night:  { sky: ['#050818', '#101a42', '#26356a'], light: '#3a4a8a', k: 0.45, b: 0.42, grey: '#1c2236' },
}

export type LandKind =
  | 'mountains' | 'hills' | 'dunes' | 'plains' | 'mesa' | 'canyon' | 'volcano' | 'glacier' | 'tundra'
  | 'savanna' | 'swamp' | 'cliffs' | 'valley' | 'grass' | 'sand' | 'snow' | 'rock' | 'marsh'

const LAND: Record<LandKind, string> = {
  mountains: '#74849a', hills: '#6b9a5c', dunes: '#dcb36c', plains: '#9bb25e', mesa: '#bd6a40', canyon: '#b0583a',
  volcano: '#5d4b4b', glacier: '#c9deeb', tundra: '#a9b4a0', savanna: '#c6aa5a', swamp: '#5f7c5c', cliffs: '#7e7569',
  valley: '#7aa25c', grass: '#79a85a', sand: '#e2c07a', snow: '#f1f6fa', rock: '#b87a4c', marsh: '#66805a',
}
const SNOW = '#f4f8fb'
/** Land that snow can bury entirely: flat ground. Mountains keep their rock and get caps instead. */
const FLAT: ReadonlySet<LandKind> = new Set(['hills', 'plains', 'valley', 'tundra', 'savanna', 'swamp', 'grass', 'marsh', 'dunes', 'sand'])

export interface Pal {
  sky: [string, string, string]
  light: string
  brightness: number
  fog: string
  /** Colour of a land kind before lighting, with ground tint and snow applied. */
  land(kind: LandKind): string
  /** Apply time-of-day light, weather darkening and distance haze (0 = near, 1 = far). */
  lit(hex: string, haze?: number): string
  water: { top: string; bottom: string; line: string }
  /** Colour for snow, lit. */
  snow: string
  /** Light cloud body colour and its shadow. */
  cloud: { body: string; shade: string }
}

export function makePalette(r: Resolved): Pal {
  const T = TIME[r.time]
  const w = r.weather
  const grey = clamp01(w.clouds * 0.5 + w.rain * 0.45 + w.fog * 0.2)
  const tint = r.palette.skyTint

  const sky = T.sky.map((c, i) => {
    const t = tint ? mix(c, shade(tint, Math.min(1, T.b + 0.15)), [0.35, 0.5, 0.55][i] as number) : c
    return mix(t, T.grey, Math.min(0.85, grey * 0.9))
  }) as [string, string, string]

  const brightness = T.b * (1 - 0.14 * w.clouds - 0.12 * w.rain - 0.12 * r.spooky)
  const fogAmt = w.fog

  const lit = (hex: string, haze = 0) => {
    let c = mix(shade(hex, brightness), T.light, T.k)
    c = mix(c, sky[2], clamp01(haze * 0.75 + fogAmt * 0.45 * (0.4 + haze)))
    return c
  }

  const land = (kind: LandKind) => {
    let c = LAND[kind]
    if (r.palette.groundTint) c = mix(c, r.palette.groundTint, FLAT.has(kind) ? 0.6 : 0.35)
    if (r.snowCover > 0) c = mix(c, SNOW, r.snowCover * (FLAT.has(kind) ? 0.85 : 0.1))
    return c
  }

  const wTint = r.palette.waterTint
  const wTop = mix('#5aa9cf', wTint ?? '#5aa9cf', wTint ? 0.6 : 0)
  const wBot = mix('#1d5c8c', wTint ? shade(wTint, 0.55) : '#1d5c8c', wTint ? 0.6 : 0)
  const water = {
    top: mix(lit(wTop), sky[2], 0.4),
    bottom: lit(wBot),
    line: mix(lit(wTop), '#ffffff', r.time === 'night' ? 0.25 : 0.5),
  }

  const cloudBase = mix('#ffffff', T.light, T.k + 0.1)
  const cloudBody = mix(shade(cloudBase, Math.min(1, brightness + 0.18)), T.grey, grey * 0.5)
  return {
    sky, light: T.light, brightness, fog: mix(sky[2], '#ffffff', r.time === 'night' ? 0.1 : 0.35), land, lit, water,
    snow: lit(SNOW, 0),
    cloud: { body: cloudBody, shade: shade(cloudBody, 0.82) },
  }
}
