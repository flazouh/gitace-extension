/**
 * Builds every screen into one classic script, for a document that arrives on a
 * pull request.
 *
 *     bun run build:arrival    (and as part of `bun run build`, after the screens)
 *
 * Why, and why every screen: see `Arrival` in `src/app/arrival.ts`. The manifest
 * injects it ahead of the shell on those documents; see `arrivingOn` in
 * `wxt.config.ts`.
 *
 * After `build-screens.ts`, because it carries the stylesheet that build writes, as
 * text: a content script's fetch can wait on GitHub's page like its imports can.
 *
 * Not built while developing. The screens rebuild on save there and this would not,
 * so a pull request opened directly would draw yesterday's interface.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { build, type Rolldown } from "vite"
import { asciiOnly } from "./ascii"
import { define, here, intro, plugins, resolve } from "./screenBuild"

/** Where the manifest names it. */
const OUT = here("../public/arrival.js")

const css = readFileSync(here("../public/screens/styles.css"), "utf8")

const result = (await build({
  configFile: false,
  publicDir: false,
  plugins: plugins(),
  resolve,
  define: { ...define, __ARRIVAL_CSS__: JSON.stringify(css) },
  base: "./",
  build: {
    write: false,
    target: "chrome120",
    minify: true,
    rollupOptions: {
      input: here("../src/screens/arrival.ts"),
      output: { format: "iife", intro },
      onwarn: (warning, warn) => {
        // A classic script has no `import.meta`, and the bundler writes `{}` for it.
        // Only Vite's preload helper reads it, for the chunks it is to preload, and
        // a script that cannot be split has none.
        if (warning.code === "EMPTY_IMPORT_META") return
        warn(warning)
      }
    }
  },
  logLevel: "warn"
})) as Rolldown.RolldownOutput

const chunks = result.output.filter((item) => item.type === "chunk")
const [script] = chunks
if (script === undefined || chunks.length !== 1)
  throw new Error(`expected one script for the arrival, built ${chunks.length}`)

// The renderer is a file of its own, fetched when a diff is drawn. Modules here are
// kept whole, so one import of anything from the engine carried the whole library
// and every grammar in it, three megabytes in front of each pull request.
const renderer = Object.keys(script.modules).find((id) => id.includes("node_modules/@pierre/diffs/"))
if (renderer !== undefined) throw new Error(`the diff renderer was built into the arrival, through ${renderer}`)

writeFileSync(OUT, asciiOnly(script.code))
console.log("built public/arrival.js")
