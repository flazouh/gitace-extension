import { looksLikeTest } from "../domain/testing"

/** One line the list of a name's uses holds: where it is written, or a use of it. */
export type Hit = {
  readonly path: string
  readonly line: number
  /** The columns the name itself occupies, one-based, for marking it. */
  readonly from?: number
  readonly to?: number
  /** Where the name is written: listed, so it can be reached, and never counted as a use. */
  readonly written: boolean
  /** Whether the repository stated this use or merely holds the word. */
  readonly sure: boolean
  /** Whether the line only brings the name in: an import, or a re-export. */
  readonly imported: boolean
  /** The line as it is known without reading its file, where it is: a Writing's signature. */
  readonly said?: string
}

/** Which uses the reader asked to see, as the two boxes at the head of the list say. */
export type Shown = { readonly imports: boolean; readonly tests: boolean }

/** One file's lines, under the file's name. */
export type Group = { readonly path: string; readonly hits: ReadonlyArray<Hit> }

export type Listing = {
  readonly groups: ReadonlyArray<Group>
  /** The uses left once the boxes have had their say, which is what the head counts. */
  readonly uses: ReadonlyArray<Hit>
  readonly hidden: number
  /** How many uses each box would hold back, whatever it says now. */
  readonly imports: number
  readonly tests: number
}

/**
 * The lines, by file, in the order a reader asks about them.
 *
 * By file rather than as this file and then the rest, because the question a
 * reviewer has about a list of uses is which files depend on this, and a path
 * repeated on every row of a long list was the only place that was said. The
 * file being read comes first, since its uses are the ones on the screen already;
 * then the code, then the tests, which prove the code and are read after it.
 *
 * Where it is written is never held back by a box: it is the one line the list
 * holds that is not a use, and the way to it.
 */
export const listing = (hits: ReadonlyArray<Hit>, here: string, shown: Shown): Listing => {
  const uses = hits.filter((hit) => !hit.written)
  const kept = hits.filter(
    (hit) => hit.written || ((shown.imports || !hit.imported) && (shown.tests || !looksLikeTest(hit.path)))
  )

  const byPath = new Map<string, Array<Hit>>()
  for (const hit of kept) {
    const held = byPath.get(hit.path)
    if (held === undefined) byPath.set(hit.path, [hit])
    else held.push(hit)
  }

  const groups = [...byPath]
    .map(([path, held]) => ({ path, hits: [...held].sort((one, two) => one.line - two.line) }))
    .sort(
      (one, two) =>
        Number(two.path === here) - Number(one.path === here) ||
        Number(looksLikeTest(one.path)) - Number(looksLikeTest(two.path)) ||
        one.path.localeCompare(two.path)
    )

  const left = kept.filter((hit) => !hit.written)
  return {
    groups,
    uses: left,
    hidden: uses.length - left.length,
    imports: uses.filter((hit) => hit.imported).length,
    tests: uses.filter((hit) => looksLikeTest(hit.path)).length
  }
}

const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/**
 * What the head says about the list: how many uses, in how many files, and how
 * much of that the pull request wrote.
 *
 * `added` is how many of the uses are on lines the pull request adds, and absent
 * where there is no pull request or its diffs have not been read yet — the head
 * then says the counts alone rather than a guess about the rest.
 */
export const summary = (uses: ReadonlyArray<Hit>, hidden: number, added?: number): string => {
  const files = new Set(uses.map((hit) => hit.path)).size
  const parts = [
    uses.length === 0 ? "no uses" : `${counted(uses.length, "use", "uses")} in ${counted(files, "file", "files")}`
  ]
  if (added !== undefined && uses.length > 0) {
    parts.push(
      added === uses.length
        ? "all added by this PR"
        : added > 0
          ? `${added} added by this PR`
          : "none touched by this PR"
    )
  }
  if (hidden > 0) parts.push(`${hidden} hidden`)
  return parts.join(" · ")
}

/** The last folder and the name, which is what tells two files in a list apart. */
export const shortPath = (path: string): string => path.split("/").slice(-2).join("/")

/** The highlighter's word for a file's language, where it knows that language. */
export const languageOf = (path: string): string => {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase()
  if (["ts", "tsx", "mts", "cts"].includes(extension)) return "typescript"
  if (["js", "jsx", "mjs", "cjs"].includes(extension)) return "javascript"
  if (extension === "json") return "json"
  if (extension === "sh" || extension === "bash") return "shellscript"
  return ""
}
