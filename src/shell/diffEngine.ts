import { Effect } from "effect"
import { diffChoices } from "../domain/choices"
import type { Settings } from "../domain/Settings"
import { syntaxOf } from "../domain/syntax"
import { packOf, type Pack } from "../domain/theme"
import { DiffEngineUnavailable, type DiffEngine } from "../ports/Renderer"
import { lendCustomElements } from "../ui/customElements"

/** Where the manifest publishes it. */
const ENGINE = "/diff-engine.js"

let loaded: DiffEngine | undefined

/**
 * Fetches the renderer, once, the way an extension has to.
 *
 * The import is by extension URL rather than by path: a content script's
 * relative imports resolve against github.com, where this file does not exist
 * and would not be allowed to. The result is held so the second file someone
 * opens costs nothing, and a failure is not held, so a flaky first load can be
 * tried again.
 *
 * This lives in the shell because both halves of it are this platform's: an
 * extension URL, and the interface's custom elements handed to a renderer that
 * is not allowed to know the interface exists. Another platform writes its own
 * few lines here — a static import, most likely — and nothing above it moves.
 */
export const loadDiffEngine = Effect.suspend(() => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: () => {
      lendCustomElements()
      // The browser holds the module itself, so a second import of the same URL
      // costs nothing and a failed one is not remembered by anybody.
      return import(/* @vite-ignore */ browser.runtime.getURL(ENGINE))
    },
    catch: (cause) => new DiffEngineUnavailable({ cause })
  }).pipe(
    Effect.map((module) => module as DiffEngine),
    Effect.tap((module) =>
      Effect.sync(() => {
        loaded = module
      })
    )
  )
})

/**
 * Where a pack chosen as `match` can resolve: GitHub's own colours on their page, ours
 * in a window of our own. Both are warmed, since which one this is is the theme's
 * business and a theme nobody draws in costs one small import.
 */
const MATCHED: ReadonlyArray<Pack> = ["github", "cursor"]

/**
 * The engine loaded and its highlighter made, in the reader's colours and for these
 * files, before the first file is drawn.
 *
 * Started with the screen rather than with the first draw: the renderer draws nothing
 * until its highlighter exists, and making one on the first draw put a third of a
 * second between a pull request's title and its first diff. See `warm` in the engine.
 */
export const warmDiffEngine = (
  chosen: Settings,
  paths: ReadonlyArray<string>
): Effect.Effect<void, DiffEngineUnavailable> => {
  const syntax = diffChoices(chosen.diff).syntax
  const themes = MATCHED.flatMap((here) => {
    const pair = syntaxOf(syntax, packOf(chosen.theme.pack, here))
    return [pair.dark, pair.light]
  })

  return loadDiffEngine.pipe(Effect.flatMap((engine) => engine.warm(themes, paths)))
}
