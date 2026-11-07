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
  setText('title', S.appName); setText('tagline', S.tagline); setText('label', S.label)
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
}
