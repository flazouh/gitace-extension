/**
 * The colours of the dark field behind the hero, the plate and the band.
 *
 * useace.dev paints that field with a photograph of grain. This page draws it: CSS
 * gradients in Ace's brown, cream and blue, and a grain made by an SVG noise filter.
 * Nothing is fetched, nothing moves, and so there is nothing for reduced motion to stop.
 *
 * The values are here rather than in the stylesheet because two readers need them:
 * `Atmosphere.tsx` builds the gradients from them, and `contrast.test.ts` checks the
 * text on top against the lightest colour each field reaches where that text sits.
 * A stop that brightens a text zone fails the test before it reaches a reader.
 */

export const NIGHT = "#120d0b"

/**
 * The warm glow at the top right of the hero, at its brightest.
 *
 * The nav's GitHub and Install links and the hero's install block sit inside it, so it
 * is held this dark on purpose: lighter, and the violet link text fell under 4.5:1.
 */
export const HERO_GLOW = "#5e3826"

/** The glow's falloff, and a cool shadow low on the left. */
export const HERO_GLOW_EDGE = "#3a2218"
export const HERO_COOL = "#1d2333"

/** The cream horizon under the window, lit blue from behind, as Ace draws it. */
export const HORIZON = ["#f4efe8", "#e9e4dc", "#d9d4cc"] as const

/**
 * How strongly the grain is laid over the field, as an `overlay` blend at this opacity.
 *
 * Overlay lightens a dark pixel by at most this fraction of its own value, which is
 * what the contrast test assumes when it lightens a field by the grain.
 */
export const GRAIN = 0.16

/**
 * The band, left to right on a wide screen and top to bottom on a narrow one.
 *
 * Ace's band goes from night through copper and cream to slate blue. The words and the
 * button sit at the start, so the start stays dark until `BAND_TEXT_EDGE`; the light
 * colours begin past the place the words can reach.
 */
export const BAND_WIDE = [
  [NIGHT, 0],
  ["#24160f", 28],
  ["#4a2c1e", 44],
  ["#8a5a40", 56],
  ["#c99a78", 64],
  ["#ead8c6", 74],
  ["#a9b4cf", 87],
  ["#7889b3", 100]
] as const

export const BAND_NARROW = [
  [NIGHT, 0],
  ["#24160f", 30],
  ["#4a2c1e", 50],
  ["#8a5a40", 62],
  ["#c99a78", 70],
  ["#ead8c6", 80],
  ["#a9b4cf", 90],
  ["#7889b3", 100]
] as const

/** The lightest stop the band's words and button can stand on, wide or narrow. */
export const BAND_TEXT_EDGE = "#4a2c1e"

/**
 * The lightest colour each text-bearing field reaches under its text, before grain.
 * The hero's veil only darkens what is under it, so it is not counted.
 */
export const TEXT_FIELDS = {
  hero: HERO_GLOW,
  band: BAND_TEXT_EDGE
} as const

export type Stops = ReadonlyArray<readonly [string, number]>

export const stopsIn = (stops: Stops): string =>
  stops.map(([colour, at]) => `${colour} ${at}%`).join(", ")

/**
 * Grain as an SVG: fractal noise with its colour taken out, tiled.
 *
 * A data URL for an SVG filter, not a picture: the browser draws the noise itself.
 */
export const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
