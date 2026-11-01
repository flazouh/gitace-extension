/**
 * What every build of the screens agrees on: `build-screens.ts`, which publishes
 * them as modules, and `build-arrival.ts`, which carries them in one classic
 * script. Two builds of one source with different aliases would be two different
 * interfaces, depending on how a document was reached.
 */

import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

export const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export const plugins = () => [react(), tailwindcss()]

export const resolve = {
  alias: [
    { find: /^@\/(.*)$/, replacement: here("../src/$1") },
    // The same substitution the extension makes: Shiki minus the grammars
    // nobody's pull request is written in. See src/diff/shiki.ts.
    { find: /^shiki$/, replacement: here("../src/diff/shiki.ts") },
    { find: /^shiki\/wasm$/, replacement: here("../src/diff/shiki-wasm.ts") }
  ]
}

export const define = {
  // React reads it, and outside WXT's own build nothing has said what it is.
  "process.env.NODE_ENV": '"production"'
}

/*
 * What WXT's own build does for a content script, done here by hand: the
 * extension APIs are reached through a bare `browser`, which is a global in
 * one browser and not in the other, and these files are built outside the
 * tooling that papers over the difference.
 *
 * Assigned to the global rather than declared as a `const`. A declaration is
 * a binding nothing in its own chunk uses — the references are in the chunks
 * beside it — so the minifier is right to remove it, and did. This is a
 * statement about the world instead, which is also the only shape that
 * reaches every chunk from one place.
 */
export const intro = "globalThis.browser ??= globalThis.chrome;"
