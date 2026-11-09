import { drawLayer, HATCH_DEF, type DrawItem } from './draw'
import { AMP_ACTIVE, AMP_SETTLED, BOIL_MS, DRAW_IN_MS, FADE_OUT_MS, FILL_DELAY_MS, SETTLE_MS, VARIANTS, diffLayers, freshPaths, nextVariant, parallax } from './motion'
import { renderSvg, type Ratio } from './svgRenderer'
import { VIEW, type Layer } from '../scene/types'

const NS = 'http://www.w3.org/2000/svg'

interface LayerView {
  layer: Layer
  g: SVGGElement
  paths: SVGPathElement[]
  /** variants[v][itemIndex] = d string, filled in lazily. */
  variants: (string[] | undefined)[]
  /** Layer path index of each painted item, and the geometry keys seen last time (to spot new paths). */
  src: number[]
  keys: Set<string>
}

/** Owns the live <svg>: draws layers, boils the lines, settles after typing, animates additions and removals. */
export class Stage {
  private svg: SVGSVGElement
  private root: SVGGElement
  private defsEl: SVGDefsElement
  private views = new Map<string, LayerView>()
  private order: string[] = []
  private seed = 0
  private amp = AMP_ACTIVE
  private variant = 0
  private generation = 0
  private boilTimer = 0
  private settleTimer = 0
  private reduced: boolean
  private drag: { x: number; y: number } | null = null
  private offset = { x: 0, y: 0 }
  private lastLayers: Layer[] = []

  constructor(private host: HTMLElement) {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.svg = document.createElementNS(NS, 'svg')
    this.svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`)
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid slice')
    this.svg.setAttribute('role', 'img')
    this.svg.innerHTML =
      `<defs><clipPath id="frame"><rect width="${VIEW.w}" height="${VIEW.h}" rx="28"/></clipPath>${HATCH_DEF}</defs>` +
      `<g clip-path="url(#frame)"><g id="overscan" transform="translate(${-VIEW.w * 0.02} ${-VIEW.h * 0.02}) scale(1.04)"></g></g>`
    this.defsEl = this.svg.querySelector('defs') as SVGDefsElement
    this.root = this.svg.querySelector('#overscan') as SVGGElement
    host.replaceChildren(this.svg)
    this.bindParallax()
    this.boilTimer = window.setInterval(() => this.tick(), BOIL_MS)
  }

  setLabel(text: string): void {
    this.svg.setAttribute('aria-label', text)
  }

  /** Show a new scene. Call on every change; typing keeps the lines lively, then they settle. */
  setScene(layers: Layer[], seed: number): void {
    this.seed = seed
    this.lastLayers = layers
    this.amp = this.reduced ? AMP_SETTLED : AMP_ACTIVE
    this.generation++
    const ids = layers.map((l) => l.id)
    const diff = diffLayers(this.order, ids)

    for (const id of diff.removed) this.removeLayer(id)
    for (const layer of layers) {
      const existing = this.views.get(layer.id)
      const fresh = this.draw(layer, existing)
      if (this.reduced || this.order.length === 0) continue
      const view = this.views.get(layer.id) as LayerView
      // a new layer draws in whole; in an existing layer only the paths that were not there before do
      if (!existing) this.drawIn(view.paths)
      else if (fresh.length) this.drawIn(view.paths.filter((_, i) => fresh.includes(view.src[i] as number)))
    }
    // keep DOM order equal to scene order
    for (const layer of layers) this.root.appendChild((this.views.get(layer.id) as LayerView).g)
    this.order = ids
    this.queueVariants()
    this.scheduleSettle()
  }

  /** The current scene as a still SVG with settled jitter, for export. */
  snapshot(ratio: Ratio, label: string): string {
    return renderSvg(this.lastLayers, { label, ratio, draw: { seed: this.seed, variant: 0, amp: AMP_SETTLED, sketch: true } })
  }

  destroy(): void {
    window.clearInterval(this.boilTimer)
    window.clearTimeout(this.settleTimer)
    this.host.replaceChildren()
  }

  // ---- drawing -------------------------------------------------------------------------------

  /** Paint a layer. Returns the indices of layer paths that are new since the last paint. */
  private draw(layer: Layer, existing?: LayerView): number[] {
    const items = drawLayer(layer, { seed: this.seed, variant: 0, amp: this.amp, sketch: true })
    let view = existing
    if (!view) {
      const g = document.createElementNS(NS, 'g') as SVGGElement
      g.dataset.id = layer.id
      g.style.transition = 'transform 0.25s ease-out'
      view = { layer, g, paths: [], variants: [], src: [], keys: new Set() }
      this.views.set(layer.id, view)
    }
    const specKeys = layer.paths.map((p) => p.d)
    const fresh = existing ? freshPaths(view.keys, specKeys) : []
    view.keys = new Set(specKeys)
    view.src = items.map((i) => i.src)
    view.layer = layer
    view.variants = [items.map((i) => i.d)]
    view.g.dataset.depth = String(layer.depth)
    this.applyParallax(view)

    const gradients = view.g.querySelector('defs')
    if (gradients) gradients.remove()
    if (layer.defs) view.g.insertAdjacentHTML('afterbegin', `<defs>${layer.defs}</defs>`)

    if (view.paths.length !== items.length) {
      for (const p of view.paths) p.remove()
      view.paths = items.map(() => document.createElementNS(NS, 'path') as SVGPathElement)
      for (const p of view.paths) view.g.appendChild(p)
      view.g.querySelector('[data-raw]')?.remove()
      if (layer.raw) view.g.insertAdjacentHTML('beforeend', layer.raw.replace('<rect', '<rect data-raw="1"'))
    }
    items.forEach((it, i) => this.paint(view.paths[i] as SVGPathElement, it))
    return fresh
  }

  private paint(p: SVGPathElement, it: DrawItem): void {
    p.setAttribute('d', it.d)
    p.setAttribute('fill', it.fill ?? 'none')
    if (it.stroke) {
      p.setAttribute('stroke', it.stroke)
      p.setAttribute('stroke-width', String(it.strokeWidth ?? 2))
      p.setAttribute('stroke-linejoin', 'round')
      p.setAttribute('stroke-linecap', 'round')
    } else p.removeAttribute('stroke')
    if (it.opacity !== undefined) p.setAttribute('opacity', String(Math.round(it.opacity * 100) / 100))
    else p.removeAttribute('opacity')
    p.dataset.kind = it.kind
  }

  /** Outlines are drawn stroke by stroke first, then the colour fills in behind them. */
  private drawIn(paths: SVGPathElement[]): void {
    for (const p of paths) {
      if (p.dataset.kind === 'ink') {
        p.setAttribute('pathLength', '1')
        p.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { duration: DRAW_IN_MS, easing: 'ease-out', fill: 'backwards' })
      } else p.animate([{ opacity: 0 }, {}], { duration: DRAW_IN_MS - FILL_DELAY_MS, delay: FILL_DELAY_MS, easing: 'ease-out', fill: 'backwards' })
    }
  }

  private removeLayer(id: string): void {
    const view = this.views.get(id)
    if (!view) return
    this.views.delete(id)
    if (this.reduced) { view.g.remove(); return }
    const a = view.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT_MS, fill: 'forwards' })
    a.onfinish = () => view.g.remove()
  }

  // ---- boil and settle -----------------------------------------------------------------------

  private queueVariants(): void {
    if (this.reduced) return
    const gen = this.generation
    let v = 1
    const step = () => {
      if (gen !== this.generation || v >= VARIANTS) return
      for (const view of this.views.values()) {
        view.variants[v] = drawLayer(view.layer, { seed: this.seed, variant: v, amp: this.amp, sketch: true }).map((i) => i.d)
      }
      v++
      window.setTimeout(step, 0)
    }
    window.setTimeout(step, 0)
  }

  private scheduleSettle(): void {
    window.clearTimeout(this.settleTimer)
    if (this.reduced) return
    this.settleTimer = window.setTimeout(() => {
      this.amp = AMP_SETTLED
      this.generation++
      this.views.forEach((view) => this.draw(view.layer, view))
      this.variant = 0
      this.queueVariants()
    }, SETTLE_MS)
  }

  private tick(): void {
    if (this.reduced || document.hidden) return
    const v = nextVariant(this.variant)
    for (const view of this.views.values()) if (!view.variants[v]) return // wait until every layer has this frame
    this.variant = v
    for (const view of this.views.values()) {
      const ds = view.variants[v] as string[]
      view.paths.forEach((p, i) => p.setAttribute('d', ds[i] as string))
    }
  }

  // ---- parallax ------------------------------------------------------------------------------

  private applyParallax(view: LayerView): void {
    const { x, y } = parallax(view.layer.depth, this.offset.x, this.offset.y)
    view.g.style.transform = `translate(${x}px, ${y}px)`
  }

  private setOffset(x: number, y: number): void {
    this.offset = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }
    for (const view of this.views.values()) this.applyParallax(view)
  }

  private bindParallax(): void {
    const el = this.host
    el.style.touchAction = 'pan-y'
    el.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId) })
    el.addEventListener('pointermove', (e) => {
      if (!this.drag) return
      const r = el.getBoundingClientRect()
      this.setOffset(((e.clientX - this.drag.x) / r.width) * 3, ((e.clientY - this.drag.y) / r.height) * 3)
    })
    const end = () => { this.drag = null; this.setOffset(0, 0) }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    window.addEventListener('deviceorientation', (e) => {
      if (this.drag || e.gamma === null || e.beta === null || this.reduced) return
      this.setOffset((e.gamma ?? 0) / 30, ((e.beta ?? 45) - 45) / 30)
    })
  }
}
