/**
 * What reading one commit found, however its files arrived.
 *
 * An archive gives every file whole; a tree gives every name and the few files nobody had read.
 * Both end here, in the shape the offscreen document keeps and answers from, so that keeping it
 * is written once.
 */

import { Effect } from "effect"
import { blobSha } from "./blob"
import { isConfig } from "./configs"
import { dialectFor } from "./dialects"
import { stillToRead, type Named } from "./keeping"
import { worthReading } from "./ledger"
import type { Store } from "./store"
import type { Told } from "./writings"

export type Grown = {
  /** Every path with a saying, under the blob sha it is kept by. */
  readonly held: ReadonlyArray<Pick<Named, "path" | "sha">>
  readonly known: ReadonlyMap<string, Told>
  /** The sayings this read made, which the store does not have yet. */
  readonly fresh: ReadonlyMap<string, Told>
  /** The files nothing parses and the Ledger needs anyway. See `isConfig`. */
  readonly configs: ReadonlyArray<Named>
  /** How many files the commit holds, read or not. */
  readonly entries: number
}

/** What a file says, or nothing where no grammar here reads it. */
export type Outline = (path: string, text: string) => Told | null

/** Every file of the archive worth reading, under git's name for its contents. */
const namesFor = (files: ReadonlyMap<string, string>): Effect.Effect<ReadonlyArray<Named>, unknown> =>
  Effect.forEach(
    [...files].filter(([path, text]) => worthReading(path, text)),
    ([path, text]) => blobSha(text).pipe(Effect.map((sha) => ({ path, sha, text }))),
    { concurrency: 8 }
  )

/**
 * A commit out of every one of its files.
 *
 * Every file is hashed, and only the ones whose sha the store has no saying for are parsed.
 */
export const fromFiles = (
  using: { readonly store: Store; readonly outline: Outline },
  whole: ReadonlyMap<string, string>
): Effect.Effect<Grown, unknown> =>
  Effect.gen(function* () {
    const named = yield* namesFor(whole)

    const already = yield* using.store
      .told(named.map((one) => one.sha))
      .pipe(Effect.catch(() => Effect.succeed(new Map<string, Told>())))

    // Read through a path with a grammar. Two paths of the same contents are read once, and
    // reading them as the `.html` of a `.ts` beside it left both with nothing said.
    const readable = named.filter((one) => dialectFor(one.path) !== null)
    const fresh = new Map<string, Told>()
    for (const file of stillToRead(readable, new Set(already.keys()))) {
      const told = using.outline(file.path, file.text)
      if (told !== null) fresh.set(file.sha, told)
    }

    const known = new Map([...already, ...fresh])
    // Only the files something could be said about. A `.md` has no grammar
    // here, and a commit's manifest that named it would be a commit that could
    // never be answered off disk.
    const held = named.filter((one) => known.has(one.sha))

    const configs = yield* Effect.forEach(
      [...whole].filter(([path]) => isConfig(path)),
      ([path, text]) => blobSha(text).pipe(Effect.map((sha) => ({ path, sha, text })))
    )

    return { held, known, fresh, configs, entries: whole.size }
  })
