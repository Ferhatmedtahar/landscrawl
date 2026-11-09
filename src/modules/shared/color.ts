export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => byte(v).toString(16).padStart(2, '0')).join('')
}

/** Linear blend: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b)
  const k = Math.max(0, Math.min(1, t))
  return rgbToHex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k])
}

/** Multiply brightness: 1 keeps the colour, 0.5 halves it. */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex([r * k, g * k, b * k])
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
