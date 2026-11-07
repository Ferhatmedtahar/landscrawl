/**
 * Renders docs/gallery.png and docs/demo.gif from the real pipeline.
 * Needs Chrome (CHROME=/path/to/chrome, default google-chrome) and ImageMagick (magick).
 * Run: npm run docs:images
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '../src/parser/parse'
import { renderSvg } from '../src/render/svgRenderer'
import { buildScene } from '../src/scene/buildScene'

const chrome = process.env.CHROME ?? 'google-chrome'
const dir = mkdtempSync(join(tmpdir(), 'landscrawl-docs-'))
mkdirSync('docs', { recursive: true })

function shot(text: string, seed: number, variant: number, name: string, w: number, h: number): string {
  const svg = renderSvg(buildScene(parse(text), seed), { draw: { seed, variant, amp: 1.1, sketch: true } })
  const svgPath = join(dir, `${name}.svg`), png = join(dir, `${name}.png`)
  writeFileSync(svgPath, svg.replace('<svg ', `<svg width="${w}" height="${h}" `))
  execFileSync(chrome, ['--headless', '--disable-gpu', '--no-sandbox', `--screenshot=${png}`, `--window-size=${w},${h}`, `file://${svgPath}`], { stdio: 'ignore' })
  return png
}

const GALLERY: [string, number][] = [
  ['sunset over snowy mountains, a small cabin with a lit window, pine forest', 21],
  ['foggy lake at dawn, one boat, no clouds', 22],
  ['sahara dunes at night, full moon, a lone palm, a tent, a campfire', 23],
  ['arctic glacier with icebergs under the northern lights', 24],
  ['tropical island beach at noon, palm trees, a sailboat', 25],
  ['lighthouse on sea cliffs at dusk, birds, a boat', 26],
]
const tiles = GALLERY.map(([t, s], i) => shot(t, s, 0, `g${i}`, 640, 360))
execFileSync('magick', ['montage', ...tiles, '-tile', '3x2', '-geometry', '640x360+6+6', '-background', '#121419', 'docs/gallery.png'])

// A sentence being typed: the scene grows word by word, lines boiling between two frames.
const STEPS = ['sunset', 'sunset over snowy mountains', 'sunset over snowy mountains, a small cabin with a lit window', 'sunset over snowy mountains, a small cabin with a lit window, pine forest', 'night over snowy mountains, a small cabin with a lit window, pine forest, stars']
const frames: string[] = []
STEPS.forEach((t, i) => { for (let v = 0; v < 3; v++) frames.push(shot(t, 21, v, `d${i}-${v}`, 640, 360)) })
execFileSync('magick', ['-delay', '14', '-loop', '0', ...frames, '-layers', 'Optimize', '-colors', '96', 'docs/demo.gif'])
rmSync(dir, { recursive: true, force: true })
console.log('wrote docs/gallery.png and docs/demo.gif')
