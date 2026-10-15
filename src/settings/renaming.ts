import { Effect, Option } from "effect"
import type { ListedKeyValue } from "../ports/KeyValue"

/**
 * What a reader kept, carried across the rename from GitQuiet to GitAce Extension.
 *
 * Every key this product writes used to start `gitquiet.` or `gitquiet:` and now
 * starts `gitace.` or `gitace:` (see `ui/keeping.ts`). Without this, the first
 * version under the new name would read nothing back: no settings, no filters,
 * no drafts, no Review Passes. So each place a key lives is walked once when the
 * extension starts there, and every old entry moves to its new name.
 *
 * An entry already under its new name wins over the old one, because it was
 * written by this version and is the newer of the two. The old entry is removed
 * either way, and only after the new ones are written, so a write that fails
 * leaves the old entry where it was for the next start to try again. A second
 * run finds no old key and writes nothing.
 *
 * The old key stem is spelled here and nowhere else in `src`, on purpose. The
 * two stored words that changed with it are `renamedChoice` in `domain/Settings.ts`.
 */
const BEFORE = "gitquiet"
const AFTER = "gitace"

/** The two separators the old keys used: `gitquiet.settings` and `gitquiet:filter:…`. */
const OLD = [`${BEFORE}.`, `${BEFORE}:`] as const

/** The name an entry moves to, or nothing when its key is not one of ours from before. */
export const renamed = (key: string): Option.Option<string> =>
  OLD.some((prefix) => key.startsWith(prefix))
    ? Option.some(`${AFTER}${key.slice(BEFORE.length)}`)
    : Option.none()

/** What one place has to do: the entries to write under their new names, and the old names to drop. */
export type Carry<V> = {
  readonly moves: Readonly<Record<string, V>>
  readonly gone: ReadonlyArray<string>
}

/** The carry for everything one place holds. Pure, so the decision is tested apart from any storage. */
export const carryFor = <V>(held: Readonly<Record<string, V>>): Carry<V> => {
  const moves: Record<string, V> = {}
  const gone: Array<string> = []

  for (const [key, value] of Object.entries(held)) {
    const to = renamed(key)
    if (Option.isNone(to)) continue

    gone.push(key)
    if (!(to.value in held) && !(to.value in moves)) moves[to.value] = value
  }

  return { moves, gone }
}

/**
 * One area of the extension's own storage: `storage.sync` or `storage.local`.
 *
 * Answers how many old entries it carried, which is nothing on every start after
 * the first.
 */
export const carryArea = Effect.fn("renaming.carryArea")(function* (area: ListedKeyValue) {
  const held = yield* Effect.tryPromise(() => area.getAll())
  const { moves, gone } = carryFor(held)
  if (gone.length === 0) return 0

  if (Object.keys(moves).length > 0) yield* Effect.tryPromise(() => area.set(moves))
  yield* Effect.tryPromise(() => area.remove([...gone]))
  return gone.length
})

/** The part of the Web Storage API a carry uses, so a test can hand it a plain one. */
export type Shelf = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">

/**
 * The page's own `localStorage` or `sessionStorage`, which the content scripts
 * write on github.com and on gist.github.com.
 *
 * Synchronous, like the API it walks, because the first paint reads these names
 * synchronously too and has to find them under the new ones.
 */
export const carryShelf = Effect.fn("renaming.carryShelf")(function* (shelf: Shelf) {
  const held = yield* Effect.try(() => {
    const found: Record<string, string> = {}
    for (let at = 0; at < shelf.length; at += 1) {
      const key = shelf.key(at)
      const value = key === null ? null : shelf.getItem(key)
      if (key !== null && value !== null) found[key] = value
    }
    return found
  })
  const { moves, gone } = carryFor(held)
  if (gone.length === 0) return 0

  yield* Effect.try(() => {
    for (const [key, value] of Object.entries(moves)) shelf.setItem(key, value)
  })
  yield* Effect.try(() => {
    for (const key of gone) shelf.removeItem(key)
  })
  return gone.length
})

/**
 * The ledger's database from before the rename, `gitquiet-ledger`.
 *
 * Dropped rather than carried: it is a cache of what repositories say, filled
 * again by the next read, and the ledger now opens `gitace-ledger` instead.
 * Deleting a database that is not there succeeds, so this too does nothing
 * after the first time.
 */
export const dropOldLedger = (factory: Pick<IDBFactory, "deleteDatabase">): Effect.Effect<void, unknown> =>
  Effect.callback<void, unknown>((resume) => {
    const asked = factory.deleteDatabase(`${BEFORE}-ledger`)
    asked.onsuccess = () => resume(Effect.void)
    asked.onerror = () => resume(Effect.fail(asked.error))
    asked.onblocked = () => resume(Effect.fail("the old ledger database is still open somewhere"))
  })
