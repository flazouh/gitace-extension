import { Effect } from "effect"
import type { ListedKeyValue } from "../ports/KeyValue"
import { carryArea, carryShelf, dropOldLedger } from "./renaming"

/**
 * Where the carry in `renaming.ts` is pointed at the browser's real storage.
 *
 * Kept apart from `renaming.ts` for the reason `browserStore.ts` is kept apart
 * from `store.ts`: the decision is tested with plain stand-ins, and this half
 * reaches for globals that exist only where an extension is running.
 *
 * Every failure here is swallowed. A carry that could not run leaves the old
 * entries in place, the next start tries again, and nothing is worth refusing
 * to show a pull request over.
 */

type Area = {
  readonly get: (keys: string | Array<string> | null) => PromiseLike<Record<string, unknown>>
  readonly set: (items: Record<string, unknown>) => PromiseLike<void>
  readonly remove: (keys: Array<string>) => PromiseLike<void>
}

const listed = (area: Area): ListedKeyValue => ({
  getAll: () => area.get(null),
  get: (keys) => area.get(keys),
  set: (items) => area.set(items),
  remove: (keys) => area.remove(keys)
})

const extensionArea = (which: "sync" | "local"): Area | undefined =>
  typeof browser === "undefined" ? undefined : browser.storage?.[which]

const carryIn = (which: "sync" | "local"): Effect.Effect<void> => {
  const area = extensionArea(which)
  return area === undefined ? Effect.void : carryArea(listed(area)).pipe(Effect.ignore)
}

/**
 * The synced area, carried at most once for the life of this document.
 *
 * The settings store waits on this before its first read or write, so a page
 * that opens before the worker has carried anything still finds the reader's
 * choices, and a default written in that gap cannot shadow them.
 */
let syncCarried: Effect.Effect<void> | undefined

export const carriedSync = (): Effect.Effect<void> => {
  syncCarried ??= carryIn("sync").pipe(Effect.cached, Effect.runSync)
  return syncCarried
}

/**
 * The extension's own storage, both areas it uses, and the old ledger cache.
 *
 * Run by the worker when this version is installed or updated, which is the one
 * moment the old names can first be there. Not on every wake of the worker:
 * `storage.local` holds megabytes of cached payloads, and listing them every
 * thirty seconds to find nothing would be the cost of a rename paid for ever.
 */
export const carryExtensionStorage = (): Effect.Effect<void> =>
  Effect.all(
    [
      carriedSync(),
      carryIn("local"),
      typeof indexedDB === "undefined" ? Effect.void : dropOldLedger(indexedDB).pipe(Effect.ignore)
    ],
    { discard: true }
  )

const shelf = (which: "localStorage" | "sessionStorage"): Effect.Effect<void> =>
  Effect.try((): Storage | undefined => globalThis[which]).pipe(
    Effect.flatMap((found) => (found === undefined ? Effect.void : carryShelf(found))),
    Effect.ignore
  )

/**
 * The page's own storage, on github.com or gist.github.com, where the content
 * scripts keep what has to be read synchronously.
 *
 * Synchronous, and run first thing in each content script, so the first paint
 * and every read after it find the names they now ask for.
 */
export const carryPageStorage = (): Effect.Effect<void> =>
  Effect.all([shelf("localStorage"), shelf("sessionStorage")], { discard: true })
