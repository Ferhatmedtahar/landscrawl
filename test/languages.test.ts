import { describe, expect, it } from 'vitest'
import { languages, registerLexicon, type RawLexicon } from '../src/lexicon'
import { parse } from '../src/parser/parse'
import { EN, langMeta, registerLanguage } from '../src/ui/i18n'
import { decodeHash } from '../src/ui/share'

/** A tiny pretend language: proves that a new language is one JSON-shaped object plus UI strings. */
const toy: RawLexicon = {
  lang: 'xx',
  stopwords: ['un', 'une', 'le', 'la', 'de', 'sur', 'au', 'avec'],
  connectors: ['ou'],
  negators: ['sans', 'pas'],
  modifiers: [{ keys: ['fort', 'forte'], level: 0.9 }],
  colors: { rouge: '#c8423b' },
  traits: [
    { keys: ['montagne'], set: { 'terrain+': ['mountains'] }, tint: 'groundTint' },
    { keys: ['nuage'], set: { 'weather.clouds': 0.6 } },
    { keys: ['pluie'], set: { 'weather.rain': 0.6 } },
    { keys: ['ciel'], set: {}, tint: 'skyTint' },
    { keys: ['coucher de soleil'], set: { time: 'sunset' } },
  ],
}

describe('adding a language', () => {
  registerLexicon(toy)
  registerLanguage({ code: 'xx', name: 'Toy', dir: 'rtl', strings: { ...EN.strings, appName: 'Toy' } })

  it('registers and is listed', () => expect(languages()).toEqual(expect.arrayContaining(['en', 'xx'])))
  it('parses with the same engine: phrases, plurals, negation, intensity, colours (colour comes before the noun)', () => {
    const s = parse('coucher de soleil sur une montagne, sans nuages', 'xx')
    expect(s.time).toBe('sunset'); expect(s.terrain).toContain('mountains'); expect(s.weather.clouds).toBe(0)
    expect(parse('forte pluie', 'xx').weather.rain).toBeCloseTo(0.9)
    expect(parse('rouge ciel', 'xx').palette.skyTint).toBe('#c8423b')
  })
  it('keeps languages apart: English words are unknown to the toy lexicon', () => {
    expect(parse('mountains', 'xx').unknownWords).toEqual(['mountains'])
    expect(parse('montagne', 'en').unknownWords).toEqual(['montagne'])
  })
  it('right-to-left is a property of the language', () => {
    expect(langMeta('xx').dir).toBe('rtl'); expect(langMeta('en').dir).toBe('ltr')
  })
  it('share links accept any registered language', () => {
    expect(decodeHash('#l=xx', { seed: 1, text: '', lang: 'en', ratio: '16:9' }).lang).toBe('xx')
  })
})
