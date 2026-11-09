/** Sentences for "Surprise me" and the cycling placeholder. Every one should draw a good picture. */
export const EXAMPLES: readonly string[] = [
  'sunset over snowy mountains, a small cabin with a lit window, pine forest',
  'foggy lake at dawn, one boat, no clouds',
  'sahara dunes at night, full moon, a lone palm',
  'arctic glacier with icebergs under the northern lights',
  'tropical island beach at noon, palm trees, a sailboat',
  'red canyon at sunset, a river, a few clouds',
  'lighthouse on sea cliffs at dusk, birds',
  'volcano at night with smoke and stars',
  'a windmill on rolling hills, flowers, a dirt road, sunny',
  'oasis with palm grove and a camel caravan at sunrise',
  'haunted swamp, dead trees, fog, full moon',
  'alpine meadow in spring, a river, a wooden bridge',
  'blizzard over a frozen lake, a tiny cabin with a lit window',
  'desert tent and a campfire under a milky way',
  'misty fjord, pine forest, a boat, no sun',
  'pyramids on dunes at noon, a lone camel',
  'penguins on antarctic ice, an iceberg, light snow',
  'a quiet village by a river, a mosque, golden hour',
  'savanna at dawn, a lone tree, birds',
  'autumn forest, a lake, mist, a cozy cabin',
  'mediterranean sea cliffs, a village, boats, bright day',
  'castle on green hills under heavy rain',
  'stormy sea at dusk, a lighthouse, a whale',
  'mesa and cacti under a red sky, a campfire at night',
  'snowy tundra, aurora, a sled, huge moon',
  'tropical beach at night, crescent moon, a campfire, palm trees',
  'highlands, thick fog, a stone ruins, lonely',
  'purple mountains, green water, pink sky, a small boat',
  'casbah above the sea, mediterranean, sunset, birds',
  'coast with a lighthouse and a boat, starry sky',
  'hills in winter, snowing, a cabin with smoke, pine forest',
  'a lake in the mountains at dawn, one boat, reflection, mist',
  'badlands at noon, a canyon, one cactus',
  'rainy valley, a village, a road, heavy rain, grey sky',
  'glacier and a frozen river under a half moon, stars',
  'sunny countryside, flowers, a windmill, a house, a road',
  'jungle river, thick forest, palm trees, mist, a bridge',
  'dunes at sunset, a bedouin tent, two camels, no clouds',
  'island with palm trees in a calm sea, full moon, a boat',
  'epic mountains, snow, an eagle, clear sky, dawn',
  'eerie night, an old ruins, dead trees, fog, crescent moon',
  'a pond with flowers, a few trees, spring morning',
  'oasis at night, a campfire, a tent, shooting stars',
  'rainbow over green hills, a lake, a hot air balloon, light rain',
  'forest at night, fireflies, a cabin with a lit window',
  'steppe at dusk, a yurt, a campfire, a lone tree, lots of grass',
]

export const PLACEHOLDER_CYCLE_MS = 4000

/** Longest example label shown on a pill; the full sentence stays in the tooltip and is what gets drawn. */
export const PILL_CHARS = 26

/** Cut text to at most `max` characters, ending in an ellipsis, without leaving a dangling space or comma. */
export function shorten(text: string, max = PILL_CHARS): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd().replace(/[,;:\s]+$/, '')}…`
}
