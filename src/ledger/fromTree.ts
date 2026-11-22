/**
 * A new commit of a repository already read, without its archive.
 *
 * The archive is every byte of the repository, and a push changes a few files of it. On a
 * large monorepo it is a hundred megabytes, most of it fixtures and images, and it takes
 * minutes to arrive for a commit that touched four files — every other one of which already
 * has a saying under its blob sha.
 *
 * So the commit's tree first: one request that names every file and its blob sha. What the
 * store knows is not fetched; what it does not is fetched file by file, parsed, and kept
 * exactly as the archive's would have been.
 *
 * Public repositories only, and that is the API rather than a choice. The tree with blob shas
 * is on `api.github.com`, which takes a token and not the session this extension reads
 * github.com with, and the raw host it fetches files from takes neither. A private
 * repository answers 404 here and is read from its archive, as it was before. Without a
 * token the API also answers an address sixty times an hour, one per new commit read, and a
 * refusal past that is read from the archive the same way.
 */

import { Effect } from "effect"
import { blobSha } from "./blob"
import { isConfig } from "./configs"
import { dialectFor } from "./dialects"
import { fromFiles, SLICE_MS, yieldTurn, type Grown, type Outline } from "./grown"
import type { Named } from "./keeping"
import { worthReading } from "./ledger"
import type { Repo } from "./packages"
import type { Manifest, Store } from "./store"
import type { Told } from "./writings"
import { rawContentAt } from "@/domain/fileAt"

/** Whatever fetches. Named so a test can be one. */
export type Fetching = (url: string, init?: RequestInit) => PromiseLike<Response>

/** One file of a commit's tree, as git lists it. */
export type Entry = { readonly path: string; readonly sha: string; readonly size: number }

/**
 * How many files are worth fetching one at a time before the archive is the cheaper way.
 *
 * Measured on `microsoft/vscode`, 21,000 files: the archive arrived in 40 to 55 seconds,
 * about 2 ms a file, and 108 files fetched sixteen at a time took 4 to 6 seconds, about 50 ms
 * each. So one file alone costs what some twenty-five cost in the archive, and past that
 * share of the repository the archive is read instead — which is also what a small
 * repository's archive of a few hundred kilobytes always wins. Three hundred is the most in
 * any case: fifteen seconds of requests, and a commit that far from anything read before is a
 * cold read.
 */
export const MOST_FETCHED = 300
const ARCHIVE_SHARE = 25

const IN_FLIGHT = 16

/** A symbolic link is a blob in a tree, and the archive leaves it out; so does this. */
const LINK = "120000"

/**
 * Past this a file is passed over without fetching it.
 *
 * `worthReading` counts characters and the tree counts bytes; a character is at most three
 * bytes of UTF-8, so nothing past three times its limit could be read.
 */
const TOO_BIG = 1_200_000

const isEntry = (one: unknown): one is { path: string; mode: string; type: string; sha: string; size?: number } => {
  if (typeof one !== "object" || one === null) return false
  const said = one as Record<string, unknown>
  return (
    typeof said["path"] === "string" &&
    typeof said["mode"] === "string" &&
    typeof said["type"] === "string" &&
    typeof said["sha"] === "string"
  )
}

/**
 * Every file of a commit, with its blob sha, in one request.
 *
 * A truncated tree fails rather than answering in part: a file it left out would be a file
 * the Ledger says nothing about, and the reader about to ask about it would be told it is
 * written nowhere.
 */
export const treeAt = (fetching: Fetching, repo: Repo, sha: string): Effect.Effect<ReadonlyArray<Entry>, unknown> =>
  Effect.gen(function* () {
    const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${sha}?recursive=1`
    const answer = yield* Effect.tryPromise({
      try: () => fetching(url, { credentials: "omit", headers: { Accept: "application/vnd.github+json" } }),
      catch: (cause) => cause
    })
    if (!answer.ok) return yield* Effect.fail(`HTTP ${answer.status} for the tree`)

    const said: unknown = yield* Effect.tryPromise({ try: () => answer.json(), catch: (cause) => cause })
    if (typeof said !== "object" || said === null) return yield* Effect.fail("the tree is not an object")
    const tree = said as Record<string, unknown>
    if (tree["truncated"] !== false) return yield* Effect.fail("the tree is truncated")
    if (!Array.isArray(tree["tree"])) return yield* Effect.fail("the tree lists nothing")

    return tree["tree"]
      .filter(isEntry)
      .filter((one) => one.type === "blob" && one.mode !== LINK)
      .map((one) => ({ path: one.path, sha: one.sha, size: one.size ?? 0 }))
  })

/** One file's text at a commit, off the raw host. */
const textAt = (fetching: Fetching, repo: Repo, sha: string, path: string): Effect.Effect<string, unknown> =>
  Effect.tryPromise({
    try: () => fetching(rawContentAt({ owner: repo.owner, repo: repo.repo, on: sha, path }), { credentials: "omit" }),
    catch: (cause) => cause
  }).pipe(
    Effect.flatMap((answer) =>
      answer.ok
        ? Effect.tryPromise({ try: () => answer.text(), catch: (cause) => cause })
        : Effect.fail(`HTTP ${answer.status} for ${path}`)
    )
  )

/**
 * A commit read from its tree and the files the store does not know.
 *
 * `base` is another commit of the same repository already read, which is the reason to
 * expect that most of this one is known, and where its config files are carried from.
 *
 * Fails, and leaves the archive to answer, where the tree cannot be had or too much is new.
 * Nothing is kept here: what was read is handed back, and the caller keeps it as it keeps
 * what an archive gave.
 */
export const fromTree = (
  using: { readonly fetching: Fetching; readonly store: Store; readonly outline: Outline },
  repo: Repo,
  sha: string,
  base: Manifest
): Effect.Effect<Grown & { readonly fetched: number }, unknown> =>
  Effect.gen(function* () {
    const entries = yield* treeAt(using.fetching, repo, sha)

    // Every file the archive would have named, grammar or not: a path no grammar reads still
    // holds a saying where its contents are a file one did read, as the archive's does.
    const candidates = entries.filter((one) => one.size <= TOO_BIG && worthReading(one.path, ""))
    const already = yield* using.store
      .told([...new Set(candidates.map((one) => one.sha))])
      .pipe(Effect.catch(() => Effect.succeed(new Map<string, Told>())))

    const missing = new Map<string, Entry>()
    for (const one of candidates) {
      if (already.has(one.sha) || missing.has(one.sha) || dialectFor(one.path) === null) continue
      missing.set(one.sha, one)
    }

    const carried = new Map((base.configs ?? []).map(([path, blob, text]) => [`${path}\0${blob}`, text]))
    const configs = entries.filter((one) => isConfig(one.path))
    const toFetch = configs.filter((one) => !carried.has(`${one.path}\0${one.sha}`))

    const asked = missing.size + toFetch.length
    if (asked > MOST_FETCHED || asked * ARCHIVE_SHARE > entries.length) {
      return yield* Effect.fail(`${asked} of ${entries.length} files are new, which the archive reads sooner`)
    }

    /*
     * Keyed by the sha of the text that was parsed, as the archive's are, and not by the sha
     * the tree said. The two differ for a file the text cannot hold byte for byte — a byte
     * order mark, bytes that are not UTF-8 — and a saying kept under git's sha would then be
     * a saying of contents it was never read from.
     */
    const read = yield* Effect.forEach(
      [...missing.values()],
      (one) =>
        textAt(using.fetching, repo, sha, one.path).pipe(
          Effect.flatMap((text) => blobSha(text).pipe(Effect.map((named) => ({ one, text, named }))))
        ),
      { concurrency: IN_FLIGHT }
    )

    const renamed = new Map<string, string>()
    const fresh = new Map<string, Told>()
    let sliceStart = performance.now()
    for (const { one, text, named } of read) {
      if (!worthReading(one.path, text)) continue
      const told = using.outline(one.path, text)
      if (told === null) continue
      fresh.set(named, told)
      renamed.set(one.sha, named)
      if (performance.now() - sliceStart >= SLICE_MS) {
        yield* yieldTurn
        sliceStart = performance.now()
      }
    }

    const fetchedConfigs = yield* Effect.forEach(
      toFetch,
      (one) => textAt(using.fetching, repo, sha, one.path).pipe(Effect.map((text) => ({ ...one, text }))),
      { concurrency: IN_FLIGHT }
    )
    const fetchedAt = new Map(fetchedConfigs.map((one) => [one.path, one.text]))

    const known = new Map([...already, ...fresh])
    const held: Array<Pick<Named, "path" | "sha">> = []
    for (const one of candidates) {
      const blob = already.has(one.sha) ? one.sha : renamed.get(one.sha)
      if (blob !== undefined) held.push({ path: one.path, sha: blob })
    }

    return {
      held,
      known,
      fresh,
      configs: configs.map((one) => ({
        path: one.path,
        sha: one.sha,
        text: carried.get(`${one.path}\0${one.sha}`) ?? fetchedAt.get(one.path) ?? ""
      })),
      entries: entries.length,
      fetched: asked
    }
  })

/**
 * A commit that is not on disk, read the cheapest way there is.
 *
 * From its tree where another commit of the repository was read before, and from `archive`
 * where none was, or the tree gave way. The archive's files come back with it, because the
 * exact tier is built from them; a commit read from its tree has none.
 */
export const grownAt = (
  using: {
    readonly fetching: Fetching
    readonly store: Store
    readonly outline: Outline
    readonly archive: Effect.Effect<ReadonlyMap<string, string>, unknown>
  },
  repo: Repo,
  sha: string
): Effect.Effect<{ readonly grown: Grown; readonly whole: ReadonlyMap<string, string> | null }, unknown> =>
  Effect.gen(function* () {
    const before = yield* using.store
      .latest(`${repo.owner}/${repo.repo}`)
      .pipe(Effect.catch(() => Effect.succeed(null)))
    const sparing =
      before === null
        ? null
        : yield* fromTree(using, repo, sha, before).pipe(Effect.catch(() => Effect.succeed(null)))
    if (sparing !== null) return { grown: sparing, whole: null }

    const whole = yield* using.archive
    return { grown: yield* fromFiles(using, whole), whole }
  })
