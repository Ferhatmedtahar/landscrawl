import { VIEW, type Layer } from '../types'

/** Layer 12: paper grain, a soft vignette and a thin frame line. */
export function paperLayer(seed: number): Layer {
  return {
    id: 'paper',
    depth: 0,
    defs:
      `<filter id="paper-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${seed % 1000}"/>` +
      `<feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.33  0 0 0 0.55 -0.15"/></filter>` +
      `<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.38"/></radialGradient>`,
    paths: [
      { d: `M0 0H${VIEW.w}V${VIEW.h}H0Z`, fill: 'url(#vignette)', still: true },
      { d: `M14 14H${VIEW.w - 14}V${VIEW.h - 14}H14Z`, stroke: '#f6efe0', strokeWidth: 3, opacity: 0.55, still: true },
    ],
    raw: `<rect width="${VIEW.w}" height="${VIEW.h}" filter="url(#paper-grain)" opacity="0.35"/>`,
  }
}
