import { removeChip } from '../parser/chips'
import { parseDetailed } from '../parser/parse'
import { Stage } from '../render/stage'
import { RATIOS, type Ratio } from '../render/svgRenderer'
import { buildScene } from '../scene/buildScene'
import { resolveScene } from '../scene/resolve'
import { describeScene } from './describe'
import { downloadPng, downloadSvg } from './export'
import { EXAMPLES, PLACEHOLDER_CYCLE_MS } from './examples'
import { langMeta } from './i18n'
import { decodeHash, encodeHash, MAX_TEXT, type ShareState } from './share'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] as number
const pickExample = (not?: string) => {
  const pool = EXAMPLES.filter((e) => e !== not)
  return pool[crypto.getRandomValues(new Uint32Array(1))[0]! % pool.length] as string
}

export function startApp(): void {
  const fallback: ShareState = { seed: randomSeed(), text: pickExample(), lang: 'en', ratio: '16:9' }
  let st = decodeHash(location.hash, fallback)
  const L = langMeta(st.lang)
  const S = L.strings
  document.documentElement.lang = L.code
  document.documentElement.dir = L.dir
  document.title = `${S.appName}: ${S.tagline}`

  const stageHost = $('stage'), input = $<HTMLTextAreaElement>('text'), chipsEl = $('chips'), status = $('status'), toast = $('toast')
  const stage = new Stage(stageHost)

  // static text from the language table
  const setText = (id: string, v: string) => { $(id).textContent = v }
  setText('wordmark', S.appName); setText('kicker', S.kicker); setText('headline', S.headline); setText('lede', S.lede)
  setText('examples-title', S.examplesTitle); setText('examples-note', S.examplesNote); setText('how-title', S.howTitle); setText('license', S.license)
  input.setAttribute('aria-label', S.label)
  $('how').replaceChildren(...S.how.map((t) => Object.assign(document.createElement('p'), { textContent: t })))
  setText('btn-surprise', S.surprise); setText('btn-reroll', S.reroll); setText('legend-ratio', S.ratio)
  setText('chips-title', S.understood); setText('btn-png', S.png); setText('btn-svg', S.svg); setText('btn-copy', S.copy); setText('privacy', S.privacy)
  input.maxLength = MAX_TEXT

  input.value = st.text
  const ratioInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="ratio"]')]
  const applyRatio = () => {
    stageHost.style.setProperty('--ratio', String(RATIOS[st.ratio]))
    for (const r of ratioInputs) r.checked = r.value === st.ratio
  }

  let hashTimer = 0
  const writeHash = () => { try { history.replaceState(null, '', encodeHash(st)) } catch { /* sandboxed frames may forbid it */ } }
  const scheduleHash = () => { window.clearTimeout(hashTimer); hashTimer = window.setTimeout(writeHash, 300) }

  // faint drifting contour lines behind the page, as on the old Describble site
  const lines = document.getElementById('lines') as unknown as SVGSVGElement
  lines.setAttribute('viewBox', '0 0 1200 800')
  lines.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const y = 40 + i * 64
    let d = `M-20 ${y}`
    for (let x = 0; x <= 1220; x += 60) d += `L${x} ${(y + Math.sin(x * 0.006 + i * 1.3) * 18 + Math.sin(x * 0.015 + i) * 6).toFixed(1)}`
    return `<path d="${d}" fill="none" stroke="rgba(246,239,225,.06)" stroke-width="1.2"/>`
  }).join('')

  // "Start from one of these": each example is a button that draws it
  $('examples').replaceChildren(...EXAMPLES.slice(0, 16).map((text) => {
    const li = document.createElement('li')
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'button', textContent: text })
    b.addEventListener('click', () => {
      st = { ...st, text }
      input.value = text
      render()
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
    li.append(b)
    return li
  }))

  let label = ''
  function render(): void {
    const parsed = parseDetailed(st.text, st.lang)
    stage.setScene(buildScene(parsed.state, st.seed), st.seed)
    label = describeScene(resolveScene(parsed.state, st.seed))
    stage.setLabel(label)

    chipsEl.replaceChildren(
      ...(parsed.chips.length === 0
        ? [Object.assign(document.createElement('li'), { className: 'hint', textContent: S.nothingYet })]
        : parsed.chips.map((chip) => {
            const li = document.createElement('li')
            const b = document.createElement('button')
            b.type = 'button'
            b.className = 'chip'
            b.setAttribute('aria-label', S.removeChip(chip.label))
            b.title = S.removeChip(chip.label)
            b.append(Object.assign(document.createElement('span'), { textContent: chip.label }), Object.assign(document.createElement('span'), { textContent: ' ×', ariaHidden: 'true' }))
            b.addEventListener('click', () => {
              st = { ...st, text: removeChip(st.text, chip) }
              input.value = st.text
              render()
              input.focus()
            })
            li.append(b)
            return li
          })),
    )

    const bits: string[] = []
    if (parsed.state.unknownWords.length) bits.push(`${S.unknown} ${parsed.state.unknownWords.join(', ')}`)
    if (parsed.state.unusedWords.length) bits.push(`${S.unused} ${parsed.state.unusedWords.join(', ')}`)
    status.textContent = bits.join(' · ')
    scheduleHash()
  }

  let frame = 0
  input.addEventListener('input', () => {
    st = { ...st, text: input.value }
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(render)
  })

  const flash = (msg: string) => {
    toast.textContent = msg
    toast.classList.add('show')
    window.setTimeout(() => { toast.classList.remove('show'); toast.textContent = '' }, 2200)
  }

  $('btn-surprise').addEventListener('click', () => {
    st = { ...st, seed: randomSeed(), text: pickExample(st.text) }
    input.value = st.text
    render()
  })
  $('btn-reroll').addEventListener('click', () => { st = { ...st, seed: randomSeed() }; render() })
  for (const r of ratioInputs) r.addEventListener('change', () => { if (r.checked) { st = { ...st, ratio: r.value as Ratio }; applyRatio(); scheduleHash() } })

  $('btn-svg').addEventListener('click', () => downloadSvg(stage.snapshot(st.ratio, label), st.ratio, st.seed))
  $('btn-png').addEventListener('click', () => {
    downloadPng(stage.snapshot(st.ratio, label), st.ratio, st.seed).catch((e: unknown) => flash(e instanceof Error ? e.message : 'Export failed'))
  })
  $('btn-copy').addEventListener('click', async () => {
    window.clearTimeout(hashTimer)
    writeHash()
    try { await navigator.clipboard.writeText(location.href); flash(S.copied) }
    catch { input.select(); flash(location.href) }
  })

  // placeholder examples cycle while the box is empty
  let ph = 0
  const cycle = () => { input.placeholder = EXAMPLES[ph++ % EXAMPLES.length] as string }
  cycle()
  window.setInterval(cycle, PLACEHOLDER_CYCLE_MS)

  window.addEventListener('hashchange', () => {
    const next = decodeHash(location.hash, st)
    if (next.seed !== st.seed || next.text !== st.text || next.ratio !== st.ratio) { st = next; input.value = st.text; applyRatio(); render() }
  })

  applyRatio()
  render()
  input.focus({ preventScroll: true })
}
