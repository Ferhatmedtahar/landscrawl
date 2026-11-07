/** UI strings. Adding a language means adding one entry here and one lexicon file. */
export interface Strings {
  appName: string
  kicker: string
  headline: string
  lede: string
  examplesTitle: string
  examplesNote: string
  howTitle: string
  how: [string, string, string]
  license: string
  tagline: string
  label: string
  png: string
  svg: string
  copy: string
  copied: string
  surprise: string
  reroll: string
  ratio: string
  understood: string
  nothingYet: string
  unknown: string
  unused: string
  privacy: string
  removeChip: (label: string) => string
}

export interface LangMeta { code: string; name: string; dir: 'ltr' | 'rtl'; strings: Strings }

export const EN: LangMeta = {
  code: 'en',
  name: 'English',
  dir: 'ltr',
  strings: {
    appName: 'Landscrawl',
    kicker: 'Free landscape maker · no AI, no sign-up',
    headline: 'Describe a place. Watch it get drawn.',
    lede: 'Hand-drawn landscapes from a sentence. No AI, no account, nothing to install.',
    examplesTitle: 'Start from one of these',
    examplesNote: 'Tap a sentence to draw it, then change any word.',
    howTitle: 'No AI. Just words and a pencil.',
    how: [
      'Your sentence is read by plain rules, word by word: places, weather, time of day, things. What it does not know it tells you.',
      'The picture is built from layers (sky, mountains, water, trees, things) with a seed, so the same sentence always draws the same landscape. Re-roll for a new one.',
      'Everything happens in this page. Download a PNG or a vector SVG, or copy a link: the link holds your sentence, and nothing is ever sent to a server.',
    ],
    license: 'Code is MIT, the drawings are CC0. Free to use for anything.',
    tagline: 'Describe a landscape and watch it get drawn.',
    label: 'Describe your landscape',
    png: 'Download PNG',
    svg: 'Download SVG',
    copy: 'Copy link',
    copied: 'Link copied',
    surprise: 'Surprise me',
    reroll: 'Re-roll',
    ratio: 'Shape',
    understood: 'What it understood',
    nothingYet: 'Nothing yet: try "sunset over snowy mountains".',
    unknown: "I didn't know:",
    unused: 'Not used:',
    privacy: 'Runs in your browser. Nothing is sent anywhere, and there is no tracking.',
    removeChip: (label) => `Remove ${label}`,
  },
}

export const LANGS: Record<string, LangMeta> = { en: EN }

/** Add UI strings for a language (set dir: 'rtl' for Arabic, Hebrew, ...). */
export function registerLanguage(meta: LangMeta): void {
  LANGS[meta.code] = meta
}
export const langMeta = (code: string): LangMeta => LANGS[code] ?? EN
