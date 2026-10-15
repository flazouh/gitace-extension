import { Effect } from "effect"
import type { Store } from "../ports/Settings"
import { carriedSync } from "./browserRenaming"
import { settingsStore } from "./store"

/**
 * The settings store a browser extension can offer, and only a browser
 * extension.
 *
 * Kept apart from `settingsStore` because that one is platform-agnostic by
 * construction — it takes somewhere to put things by name and does all the
 * deciding itself — and this one reaches for `browser`, a global that exists
 * only where an extension is running. In one file, importing the agnostic half
 * meant importing the global too, which is a typecheck a desktop app cannot
 * pass and a bundle it should not carry.
 *
 * Not there covers two cases worth keeping apart in the head: a test, where
 * there is no extension at all, and a browser that has taken the permission
 * away — from the interface's side both mean the same thing, which is that
 * choices apply to this page and are gone with it.
 */
export const browserSettings = (): Store => {
  if (typeof browser === "undefined") return settingsStore(undefined)

  const area = browser.storage?.sync
  if (area === undefined) return settingsStore(undefined)

  const store = settingsStore({
    get: (key) => area.get(key),
    set: (items) => area.set(items),
    onChanged: area.onChanged
  })

  // The settings may still sit under their name from before the rename to
  // GitAce Extension. Waited on before the first read and the first write, so
  // neither can run ahead of the carry: see `browserRenaming.ts`.
  const carried = carriedSync()
  return {
    read: Effect.andThen(carried, store.read),
    write: (settings) => Effect.andThen(carried, store.write(settings)),
    watch: store.watch
  }
}
