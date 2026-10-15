/**
 * Builds the extension's icon out of the brand mark.
 *
 *     bun scripts/build-icons.ts
 *
 * Writes `public/icon/16.png`, `32.png`, `48.png` and `128.png`, which is where WXT
 * looks for them: a PNG under that folder named for its own width becomes an entry of
 * the manifest's `icons`, and nothing in `wxt.config.ts` has to name it.
 *
 * The output is committed, like the tree's icon sheet, so a build and a release need no
 * rasteriser on the machine. Only running this does, and it needs `rsvg-convert`
 * (`brew install librsvg`): rendering each size from the vector keeps the ring crisp at
 * 16, which reducing the 128 would not.
 *
 * Ace's mark in white on a rounded square of the brand's one purple, at every size. Chrome
 * shows this image on a light toolbar and a dark one; a light or an ink square vanishes on
 * one of them, and the purple reads on both. The mark is Ace's own, unchanged: the colour
 * is what tells GitAce Extension from Ace.
 *
 * The mark below is the same as `src/ui/Mark.tsx`, which is where the
 * mark is defined for the landing page and for the store's own images. Two copies of it,
 * because the site is a separate app with its own toolchain and nothing here can hand a
 * React component to a rasteriser. Change one and change the other.
 */

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** `MARK` in `site/src/brand.ts`. */
const MARK = "#8b5cf6"

/** Ace's mark (`crates/ui/assets/ace-mark.svg` in flazouh/ace), 120 x 82. */
const ACE = "M43.7 81.4H0L85.7 0H120v81.4H76.9L61.6 64.7 43.7 81.4Zm29.2-32.2h24.4V24.6L72.9 49.2Z"

/** The mark on its tile: a 128 square with Ace's corner radius, the mark centred in the middle 60%. */
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="${MARK}" />
  <g transform="translate(25.6 37.3) scale(0.64)"><path fill="#fff" d="${ACE}" /></g>
</svg>
`

/**
 * The four Chrome asks for by name.
 *
 * 16 for the favicon of an extension's own page and its context menu entry, 32 because
 * Windows rounds to it and would otherwise reduce the 48 itself, 48 for the row on
 * `chrome://extensions`, and 128 for the store listing and the install dialog.
 */
const SIZES = [16, 32, 48, 128]

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** One size of one SVG, rasterised. Through stdin, so no SVG is left for a build to publish. */
const raster = (svg: string, size: number) =>
  execFileSync("rsvg-convert", ["--width", String(size), "--height", String(size)], {
    input: svg,
    maxBuffer: 8 * 1024 * 1024
  })

const at = here("../public/icon")
mkdirSync(at, { recursive: true })

for (const size of SIZES) {
  writeFileSync(`${at}/${size}.png`, raster(mark, size))
  console.log(`  icon/${size}.png`)
}

console.log(`\n${SIZES.length} icon(s) written to public/icon`)

