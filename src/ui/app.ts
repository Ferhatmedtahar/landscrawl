import { removeChip } from '../parser/chips'
import { parseDetailed, type Chip } from '../parser/parse'
import { Stage } from '../render/stage'
import { RATIOS, type Ratio } from '../render/svgRenderer'
import { buildScene } from '../scene/buildScene'
import { resolveScene } from '../scene/resolve'
import { describeScene } from './describe'
import { downloadPng, downloadSvg } from './export'
import { EXAMPLES, PLACEHOLDER_CYCLE_MS, shorten } from './examples'
import { langMeta, type Strings } from './i18n'
import { decodeHash, encodeHash, MAX_TEXT, type ShareState } from './share'
import { topoLines } from './topo'

const TOPO = { width: 1600, height: 1000, seed: 11 } as const
const EXAMPLE_PILLS = 16

/** Look an element up by id and fail loudly if the page and the script disagree. */
function byId<T extends Element = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id} in index.html`)
  return el as unknown as T
}

const randomInt = () => crypto.getRandomValues(new Uint32Array(1))[0] as number
const pickExample = (not?: string): string => {
  const pool = EXAMPLES.filter((e) => e !== not)
  return pool[randomInt() % pool.length] as string
}
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function button(className: string, text: string): HTMLButtonElement {
  return Object.assign(document.createElement('button'), { type: 'button', className, textContent: text })
}

function fillStaticText(S: Strings): void {
  const set = (id: string, text: string) => { byId(id).textContent = text }
  set('wordmark', S.appName); set('kicker', S.kicker); set('headline', S.headline); set('lede', S.lede)
  set('examples-title', S.examplesTitle); set('needs', S.needs); set('license', S.license); set('privacy', S.privacy)
  set('btn-png', S.png); set('btn-svg', S.svg); set('btn-copy', S.copy); set('btn-surprise', S.surprise); set('btn-reroll', S.reroll)
  set('legend-ratio', S.ratio); set('chips-title', S.understood)
  byId('how').replaceChildren(...S.how.map((text) => Object.assign(document.createElement('p'), { textContent: text })))
}

function chipItem(chip: Chip, S: Strings, onRemove: () => void): HTMLLIElement {
  const li = document.createElement('li')
  const b = button('chip', '')
  b.setAttribute('aria-label', S.removeChip(chip.label))
  b.title = S.removeChip(chip.label)
  b.append(
    Object.assign(document.createElement('span'), { textContent: chip.label }),
    Object.assign(document.createElement('span'), { textContent: ' ×', ariaHidden: 'true' }),
  )
  b.addEventListener('click', onRemove)
  li.append(b)
  return li
}

export function startApp(): void {
  const fallback: ShareState = { seed: randomInt(), text: pickExample(), lang: 'en', ratio: '16:9' }
  let st = decodeHash(location.hash, fallback)
  const L = langMeta(st.lang)
  const S = L.strings
  document.documentElement.lang = L.code
  document.documentElement.dir = L.dir
  document.title = `${S.appName}: ${S.tagline}`

  const stageHost = byId('stage'), input = byId<HTMLTextAreaElement>('text'), chipsEl = byId('chips'), status = byId('status'), toast = byId('toast')
  const stage = new Stage(stageHost)
  const ratioInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="ratio"]')]

  fillStaticText(S)
  input.setAttribute('aria-label', S.label)
  input.maxLength = MAX_TEXT
  input.value = st.text

  const lines = byId<SVGSVGElement>('lines')
  lines.setAttribute('viewBox', `0 0 ${TOPO.width} ${TOPO.height}`)
  lines.replaceChildren(...topoLines(TOPO).map((l) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', l.major ? 'major' : 'minor')
    path.setAttribute('d', l.d)
    return path
  }))

  // share link: written shortly after the last change so typing never fights the history API
  let hashTimer = 0
  const writeHash = () => { try { history.replaceState(null, '', encodeHash(st)) } catch { /* sandboxed frames may forbid it */ } }
  const scheduleHash = () => { window.clearTimeout(hashTimer); hashTimer = window.setTimeout(writeHash, 300) }

  const applyRatio = () => {
    stageHost.style.setProperty('--ratio', String(RATIOS[st.ratio]))
    for (const r of ratioInputs) r.checked = r.value === st.ratio
  }
  const setText = (text: string) => { st = { ...st, text }; input.value = text }
  const flash = (message: string) => {
    toast.textContent = message
    toast.classList.add('show')
    window.setTimeout(() => { toast.classList.remove('show'); toast.textContent = '' }, 2200)
  }

  let label = ''
  function render(): void {
    const parsed = parseDetailed(st.text, st.lang)
    stage.setScene(buildScene(parsed.state, st.seed), st.seed)
    label = describeScene(resolveScene(parsed.state, st.seed))
    stage.setLabel(label)

    chipsEl.replaceChildren(
      ...(parsed.chips.length === 0
        ? [Object.assign(document.createElement('li'), { className: 'hint', textContent: S.nothingYet })]
        : parsed.chips.map((chip) => chipItem(chip, S, () => { setText(removeChip(st.text, chip)); render(); input.focus() }))),
    )

    const notes: string[] = []
    if (parsed.state.unknownWords.length) notes.push(`${S.unknown} ${parsed.state.unknownWords.join(', ')}`)
    if (parsed.state.unusedWords.length) notes.push(`${S.unused} ${parsed.state.unusedWords.join(', ')}`)
    status.textContent = notes.join(' · ')
    scheduleHash()
  }

  // "Start from one of these": a short pill per example, the full sentence in the tooltip
  byId('examples').replaceChildren(...EXAMPLES.slice(0, EXAMPLE_PILLS).map((text) => {
    const li = document.createElement('li')
    const pill = button('button', shorten(text))
    pill.title = text
    pill.setAttribute('aria-label', text)
    pill.addEventListener('click', () => {
      setText(text)
      render()
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
    })
    li.append(pill)
    return li
  }))

  let frame = 0
  input.addEventListener('input', () => {
    st = { ...st, text: input.value }
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(render)
  })

  byId('btn-surprise').addEventListener('click', () => { st = { ...st, seed: randomInt() }; setText(pickExample(st.text)); render() })
  byId('btn-reroll').addEventListener('click', () => { st = { ...st, seed: randomInt() }; render() })
  for (const r of ratioInputs) {
    r.addEventListener('change', () => { if (r.checked) { st = { ...st, ratio: r.value as Ratio }; applyRatio(); scheduleHash() } })
  }

  byId('btn-svg').addEventListener('click', () => downloadSvg(stage.snapshot(st.ratio, label), st.ratio, st.seed))
  byId('btn-png').addEventListener('click', () => {
    downloadPng(stage.snapshot(st.ratio, label), st.ratio, st.seed).catch((e: unknown) => flash(e instanceof Error ? e.message : 'Export failed'))
  })
  byId('btn-copy').addEventListener('click', async () => {
    window.clearTimeout(hashTimer)
    writeHash()
    try { await navigator.clipboard.writeText(location.href); flash(S.copied) }
    catch { input.select(); flash(location.href) }
  })

  // placeholder examples cycle while the box is empty
  let next = 0
  const cyclePlaceholder = () => { input.placeholder = EXAMPLES[next++ % EXAMPLES.length] as string }
  cyclePlaceholder()
  window.setInterval(cyclePlaceholder, PLACEHOLDER_CYCLE_MS)

  window.addEventListener('hashchange', () => {
    const changed = decodeHash(location.hash, st)
    if (changed.seed !== st.seed || changed.text !== st.text || changed.ratio !== st.ratio) {
      st = changed
      input.value = st.text
      applyRatio()
      render()
    }
  })

  applyRatio()
  render()
  input.focus({ preventScroll: true })
}
