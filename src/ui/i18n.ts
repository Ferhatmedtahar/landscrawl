/** UI strings. Adding a language means adding one entry here and one lexicon file. */
export interface Strings {
  appName: string
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
    privacy: 'Runs in your browser. Nothing is sent anywhere.',
    removeChip: (label) => `Remove ${label}`,
  },
}

export const LANGS: Record<string, LangMeta> = { en: EN }

/** Add UI strings for a language (set dir: 'rtl' for Arabic, Hebrew, ...). */
export function registerLanguage(meta: LangMeta): void {
  LANGS[meta.code] = meta
}
export const langMeta = (code: string): LangMeta => LANGS[code] ?? EN
