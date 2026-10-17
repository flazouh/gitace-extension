/**
 * WCAG contrast, from sRGB relative luminance, for the colour pairs this site uses.
 *
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio. Colours are `#rrggbb`, or
 * `#rrggbbaa` laid over a solid background with `over`.
 */

type Rgb = readonly [number, number, number]

const channels = (hex: string): Rgb => {
  const held = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex)
  if (held?.[1] === undefined) throw new Error(`not a colour: ${hex}`)
  const n = Number.parseInt(held[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const alphaOf = (hex: string): number => (hex.length === 9 ? Number.parseInt(hex.slice(7), 16) / 255 : 1)

const toHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("")}`

const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

export const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export const ratio = (one: string, two: string): number => {
  const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** A colour with alpha, as it looks laid over a solid one. */
export const over = (top: string, under: string): string => {
  const a = alphaOf(top)
  const t = channels(top)
  const u = channels(under)
  return toHex([t[0] * a + u[0] * (1 - a), t[1] * a + u[1] * (1 - a), t[2] * a + u[2] * (1 - a)])
}

/**
 * The lightest a field can get under grain laid on it as an `overlay` blend.
 *
 * The worst grain pixel is white. Overlaid with white, a channel at or under half
 * doubles and one above half goes to full, and the layer's opacity mixes that back with
 * the field.
 */
export const grained = (field: string, opacity: number): string => {
  const lift = (c: number): number => c + opacity * ((c <= 0.5 ? 2 * c : 1) - c)
  const [r, g, b] = channels(field)
  return toHex([lift(r), lift(g), lift(b)])
}

/** WCAG 2.2 AA: 4.5 for text, 3 for large text and for the edges of controls. */
export const TEXT = 4.5
export const EDGE = 3
