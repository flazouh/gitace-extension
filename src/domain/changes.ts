import { Effect, Option } from "effect"
import type { ChangedFile, FileDiff } from "./PullRequest"

/**
 * What a pull request changed, as the list of a name's uses asks about it.
 *
 * Two questions: whether a file is one of the changed ones, and which of its lines
 * the change adds. The second is asked of the same library the diff is drawn from,
 * so a file already open costs nothing and one that is not costs the request its
 * diff would have cost when opened.
 */
export type Changes = {
  readonly paths: ReadonlySet<string>
  readonly added: (path: string) => Effect.Effect<ReadonlySet<number>>
}

/** The lines a file's diff adds, numbered as the file stands after it. */
export const addedLines = (diff: FileDiff): ReadonlySet<number> => {
  const added = new Set<number>()
  for (const line of diff.lines) {
    if (line.kind === "added" && Option.isSome(line.afterLine)) added.add(line.afterLine.value)
  }
  return added
}

const NONE: ReadonlySet<number> = new Set()

export const changesOf = (
  files: ReadonlyArray<ChangedFile>,
  ask: (path: string) => Effect.Effect<Option.Option<FileDiff>>
): Changes => {
  const paths = new Set(files.map((file) => file.path))
  return {
    paths,
    added: (path) =>
      paths.has(path)
        ? ask(path).pipe(Effect.map((diff) => (Option.isSome(diff) ? addedLines(diff.value) : NONE)))
        : Effect.succeed(NONE)
  }
}
