/** UI strings. Adding a language means adding one entry here and one lexicon file. */
export interface Strings {
  appName: string
  kicker: string
  headline: string
  lede: string
  examplesTitle: string
  needs: string
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
    needs: 'A landscape needs a time, a sky, weather, terrain, plants… even a moon and stars.',
    how: ['No AI, just words and a pencil.', 'Everything runs in this page.', 'Nothing is sent anywhere.'],
    license: 'Code MIT, drawings CC0.',
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
    privacy: 'No tracking.',
    removeChip: (label) => `Remove ${label}`,
  },
}

export const LANGS: Record<string, LangMeta> = { en: EN }

/** Add UI strings for a language (set dir: 'rtl' for Arabic, Hebrew, ...). */
export function registerLanguage(meta: LangMeta): void {
  LANGS[meta.code] = meta
}
export const langMeta = (code: string): LangMeta => LANGS[code] ?? EN
