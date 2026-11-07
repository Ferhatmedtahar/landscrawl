import { describe, expect, it } from 'vitest'
import { parse } from '../src/parser/parse'
import { editDistance, normalizeText, stem } from '../src/parser/normalize'

describe('normalize and stem', () => {
  it('lowercases, strips accents and punctuation but keeps clause breaks', () => {
    expect(normalizeText('Café  at DAWN, calm!')).toBe('cafe at dawn | calm |')
  })
  it('stems plurals only', () => {
    expect([stem('mountains'), stem('beaches'), stem('ponies'), stem('glass'), stem('cactus'), stem('oasis')])
      .toEqual(['mountain', 'beach', 'pony', 'glass', 'cactus', 'oasis'])
  })
  it('edit distance counts a swap as one', () => {
    expect(editDistance('mountain', 'mountian')).toBe(1)
    expect(editDistance('forest', 'forst')).toBe(1)
    expect(editDistance('lake', 'lake')).toBe(0)
  })
})

describe('time of day', () => {
  it.each([
    ['sunrise over the hills', 'dawn'], ['a sunset', 'sunset'], ['twilight', 'dusk'], ['evening', 'dusk'],
    ['midnight', 'night'], ['at noon', 'day'], ['golden hour', 'sunset'], ['blue hour', 'dusk'],
  ])('%s -> %s', (text, time) => expect(parse(text).time).toBe(time))
  it('nothing mentioned means null', () => expect(parse('mountains').time).toBeNull())
  it('later time word wins: day ... night', () => expect(parse('a bright day turning to night').time).toBe('night'))
  it('setting sun sets time and sun', () => {
    const s = parse('setting sun')
    expect(s.time).toBe('sunset'); expect(s.celestial.sun).toBe(true)
  })
})

describe('celestial', () => {
  it('moon phases', () => {
    expect(parse('full moon').celestial.moon).toBe('full')
    expect(parse('half moon').celestial.moon).toBe('half')
    expect(parse('crescent moon').celestial.moon).toBe('crescent')
    expect(parse('moon').celestial.moon).toBe('full')
  })
  it('moonlit implies night', () => expect(parse('a moonlit lake').time).toBe('night'))
  it('stars and milky way', () => {
    expect(parse('starry').celestial.stars).toBeCloseTo(0.8)
    expect(parse('milky way').celestial.stars).toBe(1)
  })
  it('aurora and northern lights', () => {
    expect(parse('aurora').celestial.aurora).toBeGreaterThan(0.5)
    expect(parse('northern lights over the tundra').celestial.aurora).toBeGreaterThan(0.5)
  })
  it('sunny turns the sun on and clears the sky', () => {
    const s = parse('sunny'); expect(s.celestial.sun).toBe(true); expect(s.weather.clouds).toBeLessThan(0.2)
  })
})

describe('weather', () => {
  it('rain, drizzle, downpour', () => {
    expect(parse('rain').weather.rain).toBeCloseTo(0.6)
    expect(parse('drizzle').weather.rain).toBeLessThan(0.3)
    expect(parse('downpour').weather.rain).toBeGreaterThan(0.9)
  })
  it('snow falls and covers', () => {
    const s = parse('snow'); expect(s.weather.snow).toBeGreaterThan(0); expect(s.surface.snowCover).toBeGreaterThan(0)
  })
  it('snowy covers without falling snow', () => {
    const s = parse('snowy mountains'); expect(s.surface.snowCover).toBeGreaterThan(0.5); expect(s.weather.snow).toBe(0)
  })
  it('snow capped (two words) covers', () => expect(parse('snow capped peaks').surface.snowCover).toBeCloseTo(0.6))
  it('blizzard is snow plus wind plus fog', () => {
    const s = parse('blizzard'); expect(s.weather.snow).toBeGreaterThan(0.9); expect(s.weather.wind).toBeGreaterThan(0.8); expect(s.weather.fog).toBeGreaterThan(0)
  })
  it('fog, mist, haze rank by thickness', () => {
    expect(parse('fog').weather.fog).toBeGreaterThan(parse('mist').weather.fog)
    expect(parse('mist').weather.fog).toBeGreaterThan(parse('haze').weather.fog)
  })
  it('storm brings rain, wind and clouds', () => {
    const s = parse('a storm'); expect(s.weather.rain).toBeGreaterThan(0.5); expect(s.weather.wind).toBeGreaterThan(0.5); expect(s.weather.clouds).toBeGreaterThan(0.5)
  })
  it('calm sets wind to zero', () => expect(parse('windy then calm').weather.wind).toBe(0))
  it('clear sky means no clouds', () => expect(parse('overcast, clear sky').weather.clouds).toBe(0))
  it('overcast is thick cloud', () => expect(parse('overcast').weather.clouds).toBeGreaterThan(0.8))
})

describe('terrain', () => {
  it.each([
    ['mountains', 'mountains'], ['rolling hills', 'hills'], ['sand dunes', 'dunes'], ['a prairie', 'plains'],
    ['a deep valley', 'valley'], ['sea cliffs', 'cliffs'], ['a canyon', 'canyon'], ['a mesa', 'mesa'],
    ['a volcano', 'volcano'], ['tundra', 'tundra'], ['a glacier', 'glacier'], ['savannah', 'savanna'],
    ['a swamp', 'swamp'], ['a beach', 'beach'], ['an island', 'island'], ['the ocean', 'sea'],
    ['a pond', 'lake'], ['a river', 'river'], ['a waterfall', 'waterfall'], ['an iceberg', 'iceberg'],
  ])('%s -> %s', (text, terrain) => expect(parse(text).terrain).toContain(terrain))
  it('keeps order and does not duplicate', () => {
    expect(parse('lake, mountains and a lake').terrain).toEqual(['lake', 'mountains'])
  })
  it('a pond is a small lake', () => expect(parse('pond').scale['terrain.lake']).toBeCloseTo(0.5))
  it('iceberg brings the sea with it', () => expect(parse('iceberg').terrain).toEqual(expect.arrayContaining(['sea', 'iceberg'])))
})

describe('plurals and typos', () => {
  it('plurals match', () => {
    expect(parse('mountains').terrain).toContain('mountains')
    expect(parse('mountain').terrain).toContain('mountains')
    expect(parse('three boats').objects).toContain('boat')
    expect(parse('beaches').terrain).toContain('beach')
    expect(parse('dunes').terrain).toContain('dunes')
  })
  it('one typo is forgiven in words of 5+ letters', () => {
    expect(parse('mountian').terrain).toContain('mountains')
    expect(parse('forst').vegetation.forest).toBeGreaterThan(0)
    expect(parse('lighthose').objects).toContain('lighthouse')
    expect(parse('sunnset').time).toBe('sunset')
  })
  it('typos on a plural work through the stem', () => expect(parse('mountians').terrain).toContain('mountains'))
  it('short words are not corrected', () => {
    const s = parse('lakr')
    expect(s.terrain).toEqual([]); expect(s.unknownWords).toEqual(['lakr'])
  })
  it('a wrong first letter is not a typo', () => expect(parse('peach').terrain).toEqual([]))
  it('typo matches carry lower confidence', () => {
    expect(parse('mountian').confidence['terrain.mountains']).toBeLessThan(parse('mountain').confidence['terrain.mountains']!)
  })
})

describe('negation', () => {
  it('no clouds', () => expect(parse('cloudy sky, no clouds').weather.clouds).toBe(0))
  it('no clouds removes clouds mentioned earlier in the sentence', () => expect(parse('clouds over a lake, but no clouds').weather.clouds).toBe(0))
  it('without snow', () => expect(parse('snowy mountains without snow').surface.snowCover).toBe(0))
  it('negation is sticky: a later mention does not bring it back', () => expect(parse('no fog, a foggy lake').weather.fog).toBe(0))
  it('negation reaches through "or"', () => {
    const s = parse('no snow or wind, just rain')
    expect(s.weather.snow).toBe(0); expect(s.weather.wind).toBe(0); expect(s.weather.rain).toBeGreaterThan(0)
  })
  it('negation stops at a comma', () => {
    const s = parse('no clouds, a lake')
    expect(s.weather.clouds).toBe(0); expect(s.terrain).toContain('lake')
  })
  it('negation stops at "and"', () => {
    const s = parse('no rain and a lake'); expect(s.terrain).toContain('lake')
  })
  it('negation removes terrain and objects', () => {
    expect(parse('mountains, a lake, no mountains').terrain).toEqual(['lake'])
    expect(parse('a boat on a lake without a boat').objects).toEqual([])
  })
  it('no moon clears any phase', () => expect(parse('half moon, no moon').celestial.moon).toBe('none'))
  it('no night clears the time only if it is night', () => {
    expect(parse('night, no night').time).toBeNull()
    expect(parse('sunset, no night').time).toBe('sunset')
  })
  it('skips small words between negator and noun', () => expect(parse('without any clouds, cloudy').weather.clouds).toBe(0))
  it('a negator with nothing to negate is reported as unused', () => expect(parse('mountains no').unusedWords).toContain('no'))
  it('negation beats an archetype that would add the trait', () => expect(parse('no fog, haunted').weather.fog).toBe(0))
  it('negated traits have full confidence', () => expect(parse('no clouds').confidence['weather.clouds']).toBe(1))
})

describe('intensity', () => {
  it('heavy and light scale rain', () => {
    expect(parse('heavy rain').weather.rain).toBeCloseTo(0.9)
    expect(parse('light rain').weather.rain).toBeCloseTo(0.3)
  })
  it('thick fog and dense forest', () => {
    expect(parse('thick fog').weather.fog).toBeCloseTo(0.9)
    expect(parse('a dense forest').vegetation.forest).toBeCloseTo(0.9)
  })
  it('lots of and a few', () => {
    expect(parse('lots of clouds').weather.clouds).toBeCloseTo(0.9)
    expect(parse('a few clouds').weather.clouds).toBeCloseTo(0.3)
  })
  it('levels never exceed 1', () => expect(parse('torrential blizzard').weather.snow).toBe(1))
  it('tiny and huge set a size', () => {
    expect(parse('a tiny village').scale['objects.village']).toBeCloseTo(0.5)
    expect(parse('a huge mountain').scale['terrain.mountains']).toBeCloseTo(1.6)
    expect(parse('a small lake').scale['terrain.lake']).toBeCloseTo(0.7)
  })
  it('one tree is a lone tree', () => {
    const s = parse('one tree'); expect(s.vegetation.loneTree).toBe(true); expect(s.vegetation.forest).toBe(0)
  })
  it('a lone palm', () => {
    const s = parse('a lone palm'); expect(s.vegetation.loneTree).toBe(true); expect(s.vegetation.palm).toBeLessThan(0.5)
  })
  it('counts: two boats, 3 tents', () => {
    expect(parse('two boats').counts['objects.boat']).toBe(2)
    expect(parse('3 tents').counts['objects.tent']).toBe(3)
  })
  it('one boat', () => expect(parse('one boat').counts['objects.boat']).toBe(1))
  it('a modifier attaches across a colour', () => expect(parse('a huge red sky').palette.skyTint).toBeDefined())
  it('a modifier with no target is reported', () => expect(parse('mountains. heavy').unusedWords).toContain('heavy'))
})

describe('colours', () => {
  it('red sky', () => expect(parse('red sky').palette.skyTint).toBe('#c8423b'))
  it('purple mountains', () => expect(parse('purple mountains').palette.groundTint).toBe('#7b4fa8'))
  it('green water', () => expect(parse('green water').palette.waterTint).toBe('#4c9a58'))
  it('colour attaches to the nearest noun, not the first', () => {
    const s = parse('blue sky over green hills')
    expect(s.palette.skyTint).toBe('#3f78c8'); expect(s.palette.groundTint).toBe('#4c9a58')
  })
  it('foliage', () => expect(parse('orange pine forest').palette.foliageTint).toBeDefined())
  it('a colour with no paintable noun is reported, not dropped', () => {
    const s = parse('a red cabin'); expect(s.unusedWords).toContain('red'); expect(s.objects).toContain('cabin')
  })
  it('an explicit colour beats a soft cold palette', () => expect(parse('red sky, icy').palette.skyTint).toBe('#c8423b'))
  it('golden hour is a time, not a colour', () => {
    const s = parse('golden hour'); expect(s.time).toBe('sunset'); expect(s.unusedWords).toEqual([])
  })
})

describe('archetypes', () => {
  it('sahara: dunes, sun, warm ground, maybe palm and camel', () => {
    const s = parse('sahara')
    expect(s.terrain).toContain('dunes'); expect(s.celestial.sun).toBe(true); expect(s.palette.groundTint).toBeDefined()
    expect(s.optional).toEqual(expect.arrayContaining(['vegetation.palm', 'objects.camel']))
  })
  it('arctic: snow, mountains, cold palette', () => {
    const s = parse('arctic')
    expect(s.terrain).toEqual(expect.arrayContaining(['mountains', 'glacier'])); expect(s.surface.snowCover).toBeGreaterThan(0.8); expect(s.palette.skyTint).toBeDefined()
  })
  it('antarctica has icebergs and may have penguins', () => {
    const s = parse('antarctica'); expect(s.terrain).toContain('iceberg'); expect(s.optional).toContain('objects.penguins')
  })
  it('tropical: palms, sea, warm', () => {
    const s = parse('tropical'); expect(s.vegetation.palm).toBeGreaterThan(0.5); expect(s.terrain).toContain('sea')
  })
  it('haunted: night, fog, dead trees, spooky', () => {
    const s = parse('haunted')
    expect(s.time).toBe('night'); expect(s.weather.fog).toBeGreaterThan(0.5); expect(s.vegetation.deadTrees).toBeGreaterThan(0.5); expect(s.mood.spooky).toBeGreaterThan(0.5)
  })
  it('alpine: mountains, pine, snow', () => {
    const s = parse('alpine'); expect(s.terrain).toContain('mountains'); expect(s.vegetation.pine).toBeGreaterThan(0); expect(s.surface.snowCover).toBeGreaterThan(0)
  })
  it('oasis: dunes, palms, a lake', () => {
    const s = parse('oasis'); expect(s.terrain).toEqual(expect.arrayContaining(['dunes', 'lake'])); expect(s.vegetation.palm).toBeGreaterThan(0)
  })
  it('coast: sea and cliffs, maybe a lighthouse', () => {
    const s = parse('coast'); expect(s.terrain).toEqual(expect.arrayContaining(['sea', 'cliffs'])); expect(s.optional).toContain('objects.lighthouse')
  })
  it('an archetype does not override what the text said', () => {
    expect(parse('sunset haunted').time).toBe('sunset')
    expect(parse('heavy fog, haunted').weather.fog).toBeCloseTo(0.9)
  })
  it('a hint disappears once the text names the thing', () => expect(parse('sahara with a camel').optional).not.toContain('objects.camel'))
  it('every archetype word turns on several traits', () => {
    for (const w of ['desert', 'jungle', 'fjord', 'highlands', 'countryside', 'mediterranean', 'winter', 'badlands']) {
      const s = parse(w)
      const traits = s.terrain.length + s.objects.length + Object.keys(s.confidence).length
      expect(traits, w).toBeGreaterThan(1)
    }
  })
  it('regional scenery words', () => {
    expect(parse('hoggar').terrain).toEqual(expect.arrayContaining(['mountains', 'dunes']))
    expect(parse('casbah').objects).toContain('casbah')
    expect(parse('desert tent').objects).toContain('tent')
    expect(parse('palm grove').vegetation.palm).toBeGreaterThan(0.8)
  })
})

describe('vegetation, objects and details', () => {
  it('pine forest', () => {
    const s = parse('pine forest'); expect(s.vegetation.pine).toBeGreaterThan(0.5); expect(s.vegetation.forest).toBeGreaterThan(0)
  })
  it('dead trees are not plain trees', () => {
    const s = parse('dead trees'); expect(s.vegetation.deadTrees).toBeGreaterThan(0); expect(s.vegetation.forest).toBe(0)
  })
  it('cactus and flowers', () => {
    expect(parse('cacti').vegetation.cactus).toBeGreaterThan(0)
    expect(parse('wildflowers').vegetation.flowers).toBeGreaterThan(0)
  })
  it.each([
    ['a cabin', 'cabin'], ['a lighthouse', 'lighthouse'], ['a windmill', 'windmill'], ['a camel', 'camel'], ['an igloo', 'igloo'],
    ['a pyramid', 'pyramid'], ['ancient ruins', 'ruins'], ['a sled', 'sled'], ['penguins', 'penguins'], ['a whale', 'whale'],
    ['a mosque', 'mosque'], ['a castle', 'castle'], ['a bridge', 'bridge'], ['a campfire', 'campfire'], ['a flock of birds', 'birds'],
  ])('%s -> %s', (text, obj) => expect(parse(text).objects).toContain(obj))
  it('lit window, smoke, reflection', () => {
    expect(parse('a cabin with a lit window').details.litWindows).toBe(true)
    expect(parse('chimney smoke').details.smoke).toBe(true)
    expect(parse('a mirrored lake').details.reflection).toBe(true)
  })
  it('mood words', () => {
    expect(parse('cozy').mood.cozy).toBeGreaterThan(0.5)
    expect(parse('a lonely hut').mood.lonely).toBeGreaterThan(0.5)
    expect(parse('epic').mood.grand).toBeGreaterThan(0.5)
    expect(parse('eerie').mood.spooky).toBeGreaterThan(0.5)
  })
  it('seasons are soft', () => {
    expect(parse('winter').surface.snowCover).toBeGreaterThan(0.5)
    expect(parse('snowy winter').surface.snowCover).toBeCloseTo(0.8)
  })
})

describe('unknown words and robustness', () => {
  it('unknown words are collected, never dropped', () => {
    const s = parse('mountains and a zorblax')
    expect(s.unknownWords).toEqual(['zorblax']); expect(s.terrain).toContain('mountains')
  })
  it('unknown words are deduplicated and ordered', () => expect(parse('blorp zing blorp').unknownWords).toEqual(['blorp', 'zing']))
  it('filler words are understood, not unknown', () => expect(parse('draw me a beautiful lake please').unknownWords).toEqual([]))
  it('non-Latin words are kept as unknown, not erased', () => expect(parse('جبل').unknownWords).toEqual(['جبل']))
  it('empty and whitespace input give the empty scene', () => {
    for (const t of ['', '   ', '\n', '!!!']) {
      const s = parse(t); expect(s.terrain).toEqual([]); expect(s.unknownWords).toEqual([]); expect(s.time).toBeNull()
    }
  })
  it('never throws on odd input', () => {
    for (const t of ['|', '||| no', 'no no no', 'x'.repeat(5000), '🏔️ 🌅', 'one one one', '"quoted"', '12345 67890']) expect(() => parse(t)).not.toThrow()
  })
  it('unknown language falls back to English', () => expect(parse('lake', 'xx').terrain).toContain('lake'))
  it('is deterministic', () => expect(JSON.stringify(parse('foggy lake at dawn, one boat, no clouds'))).toBe(JSON.stringify(parse('foggy lake at dawn, one boat, no clouds'))))
  it('parses fast: a 200-character sentence in under 16ms', () => {
    const text = 'sunset over snowy mountains, a small cabin with a lit window, pine forest, a frozen lake, heavy fog, two boats, a lone palm, no clouds, aurora, eerie'
    parse(text)
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) parse(text)
    expect((performance.now() - t0) / 20).toBeLessThan(16)
  })
})

describe('spec examples', () => {
  it('sunset over snowy mountains, a small cabin with a lit window, pine forest', () => {
    const s = parse('sunset over snowy mountains, a small cabin with a lit window, pine forest')
    expect(s.time).toBe('sunset'); expect(s.terrain).toContain('mountains'); expect(s.surface.snowCover).toBeGreaterThan(0.5)
    expect(s.objects).toContain('cabin'); expect(s.scale['objects.cabin']).toBeCloseTo(0.7); expect(s.details.litWindows).toBe(true)
    expect(s.vegetation.pine).toBeGreaterThan(0.5); expect(s.unknownWords).toEqual([]); expect(s.unusedWords).toEqual([])
  })
  it('foggy lake at dawn, one boat, no clouds', () => {
    const s = parse('foggy lake at dawn, one boat, no clouds')
    expect(s.weather.fog).toBeGreaterThan(0.5); expect(s.terrain).toContain('lake'); expect(s.time).toBe('dawn')
    expect(s.objects).toContain('boat'); expect(s.counts['objects.boat']).toBe(1); expect(s.weather.clouds).toBe(0); expect(s.unknownWords).toEqual([])
  })
  it('sahara dunes at night, full moon, a lone palm', () => {
    const s = parse('sahara dunes at night, full moon, a lone palm')
    expect(s.time).toBe('night'); expect(s.terrain).toContain('dunes'); expect(s.celestial.moon).toBe('full')
    expect(s.vegetation.loneTree).toBe(true); expect(s.unknownWords).toEqual([])
  })
})
