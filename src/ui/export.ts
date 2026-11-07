import { cropFor, RATIOS, type Ratio } from '../render/svgRenderer'

/** Pixel size of a PNG export: 2x the scene height, width from the ratio. */
export function pngSize(ratio: Ratio): { w: number; h: number } {
  const h = 1800
  return { w: Math.round(h * RATIOS[ratio]), h }
}

/** Give an SVG explicit pixel dimensions so any viewer or <img> sizes it right. */
export function withSize(svg: string, w: number, h: number): string {
  return svg.replace('<svg ', `<svg width="${w}" height="${h}" `)
}

export function svgForDownload(svg: string, ratio: Ratio): string {
  const c = cropFor(ratio)
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + withSize(svg, Math.round(c.w), Math.round(c.h))
}

export const fileName = (seed: number, ext: 'png' | 'svg') => `landscrawl-${seed >>> 0}.${ext}`

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadSvg(svg: string, ratio: Ratio, seed: number): void {
  save(new Blob([svgForDownload(svg, ratio)], { type: 'image/svg+xml' }), fileName(seed, 'svg'))
}

/** Draw the SVG onto an offscreen canvas at 2x and save it. The drawing has no text, so no fonts are needed. */
export async function downloadPng(svg: string, ratio: Ratio, seed: number): Promise<void> {
  const { w, h } = pngSize(ratio)
  const img = new Image()
  img.decoding = 'sync'
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(withSize(svg, w, h))
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not render the drawing to an image'))
    img.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not create the PNG')
  save(blob, fileName(seed, 'png'))
}
