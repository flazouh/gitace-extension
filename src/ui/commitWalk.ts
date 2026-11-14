import { UndefinedOr } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { COMMIT_WALK as KEY } from "./keeping"

/**
 * The commits of the page a commit was opened from, so `[` and `]` can walk to its neighbours.
 *
 * A commit knows its parent and nothing newer: what comes after it depends on the branch the
 * reader was reading. So the list says, once, on the press that leaves it, and the tab's session
 * holds that until another list is pressed from.
 */
type Walk = { readonly repo: string; readonly shas: ReadonlyArray<string> }

const held = UndefinedOr.liftThrowable((): Storage => sessionStorage)
const write = UndefinedOr.liftThrowable((store: Storage, value: string) => {
  store.setItem(KEY, value)
})
const read = UndefinedOr.liftThrowable((store: Storage): Walk | undefined => {
  const kept: unknown = JSON.parse(store.getItem(KEY) ?? "null")
  if (typeof kept !== "object" || kept === null) return undefined
  const { repo, shas } = kept as Partial<Walk>
  return typeof repo === "string" && Array.isArray(shas) ? { repo, shas } : undefined
})

const nameOf = (repo: RepoRef): string => `${repo.owner}/${repo.repo}`

/** Newest first, as the list draws them. */
export const walkFrom = (repo: RepoRef, shas: ReadonlyArray<string>): void => {
  const store = held()
  if (store !== undefined) write(store, JSON.stringify({ repo: nameOf(repo), shas } satisfies Walk))
}

/** The commits either side of this one in the list it was opened from, where it was. */
export const besideIn = (
  repo: RepoRef,
  sha: string
): { readonly older?: string; readonly newer?: string } => {
  const store = held()
  const walk = store === undefined ? undefined : read(store)
  if (walk === undefined || walk.repo !== nameOf(repo)) return {}
  const at = walk.shas.indexOf(sha)
  if (at === -1) return {}
  const older = walk.shas[at + 1]
  const newer = walk.shas[at - 1]
  return { ...(older === undefined ? {} : { older }), ...(newer === undefined ? {} : { newer }) }
}
