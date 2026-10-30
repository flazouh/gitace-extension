import { useId, useState } from "react"
import type { Destination } from "../domain/Settings"
import type { RepositoryAtWork } from "../domain/rail"
import { matching, type Repository, withPinToggled } from "../domain/repositories"
import type { Keys } from "../keys/commands"
import { useArt } from "./art"
import { RepoTile } from "./Face"
import { useKeyboard } from "./useKeyboard"
import { useKeys } from "./useKeys"

/**
 * Home's left column: the three Destinations, and the repositories a reader actually goes to.
 *
 * Reaching a repository in one press rather than two is the reason it exists, so it is not a
 * sidebar of links to pages. Everything about the reader rather than their work — starting
 * something, their account, the way back to GitHub — stands in the global rail beside it, which
 * is also where the column is hidden and shown.
 *
 * See `docs/spec/home.md`.
 */
export type RailProps = {
  /** Which Destination is being shown, so the Rail can mark it and offer the others. */
  readonly destination: Destination
  readonly onDestination: (destination: Destination) => void
  /** Ranked by `repositoriesAtWork`; drawn in the order it is given. */
  readonly atWork: ReadonlyArray<RepositoryAtWork>
  /** How much of the Working Set is open, for the Destination's count. */
  readonly needsYou: number
  /** How much happened elsewhere, for Activity's count. Absent until that read lands. */
  readonly happened?: number
  /**
   * Every repository the reader has, for the filter.
   *
   * The Rail lists the ones with work in them, which is six or so; the filter searches all of
   * them, so finding a repository is typing rather than remembering.
   */
  readonly repositories?: ReadonlyArray<Repository>
  /**
   * The repositories the reader pinned, as `owner/repo`, in the order they pinned them.
   *
   * Above the work rather than mixed into it, and unlimited: a reader who pinned a repository
   * has said it matters whether or not there is a pull request in it this week.
   */
  readonly pinned?: ReadonlyArray<string>
  readonly onPinned?: (pinned: ReadonlyArray<string>) => void
  readonly keys?: Keys
}

/** A repository as the Rail draws it, whichever of its two lists it is in. */
type Standing = {
  readonly owner: string
  readonly repo: string
  readonly count: number
}

const NONE_PINNED: ReadonlyArray<string> = []

/** Past this many, a column of names is a list to search rather than to read. */
const FILTERED_PAST = 12

const DESTINATIONS = [
  { which: "working-set", name: "Working Set", short: "Working Set" },
  { which: "repositories", name: "Repositories", short: "Repos" },
  { which: "activity", name: "Activity", short: "Activity" }
] as const

/**
 * One of the Rail's lists of repositories, pinned or at work.
 *
 * Both are the same row, which is the point: a reader pins the repository they are looking
 * at, and it moves up rather than changing into something else. The pin is quiet until the
 * row is pointed at, and stays lit on a row that is pinned.
 */
const List = ({
  name,
  heading,
  standings,
  pinned,
  onPin
}: {
  readonly name: string
  readonly heading: string
  readonly standings: ReadonlyArray<Standing>
  readonly pinned: ReadonlySet<string>
  readonly onPin?: (address: string) => void
}) => {
  const art = useArt()
  const Pin = art.pinned

  return (
    <>
      <div aria-hidden="true" className="d-sect">
        {heading}
        <span className="d-n">{standings.length}</span>
      </div>
      <ul aria-label={name} className="contents">
        {standings.map((one) => {
          const address = `${one.owner}/${one.repo}`
          const held = pinned.has(address)

          return (
            <li key={address} className="d-gpr">
              <a
                // Their pull requests rather than their code, because that is the page this
                // extension already draws and the reason the reader is looking.
                href={`/${address}/pulls`}
                aria-label={one.count === 0 ? address : `${address}, ${one.count} open`}
                className="d-gpr-link"
              >
                <RepoTile name={one.repo} />
                <span aria-hidden="true" className="d-tt">
                  {address}
                </span>
                {one.count === 0 ? null : (
                  <span aria-hidden="true" className="d-key">
                    {one.count}
                  </span>
                )}
              </a>
              {onPin === undefined ? null : (
                <button
                  type="button"
                  onClick={() => onPin(address)}
                  aria-label={`${held ? "Unpin" : "Pin"} ${address}`}
                  aria-pressed={held}
                  className="d-pin"
                >
                  <Pin size={13} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export const Rail = ({
  destination,
  onDestination,
  atWork,
  needsYou,
  happened,
  repositories = [],
  pinned = NONE_PINNED,
  onPinned,
  keys: given
}: RailProps) => {
  const keys = useKeyboard(given)
  const art = useArt()
  const [typed, setTyped] = useState("")
  const filterId = useId()

  const goTo = (which: Destination) => {
    onDestination(which)
    // Typing narrows this Rail, not the page: leaving a filter behind after a press on
    // Activity would leave a reader looking at a list they had stopped asking about.
    setTyped("")
  }

  /*
   * `g d`, `g r` and `g f` are how a reader leaves a Destination, and must work on all three.
   * Not animated and never will be: a chord pressed fifty times a day that waits for a page
   * to slide reads as slower than the page it replaced.
   */
  useKeys(keys, {
    workingSet: () => goTo("working-set"),
    repositories: () => goTo("repositories"),
    activity: () => goTo("activity")
  })

  const searching = typed.trim().length > 0
  const held = new Set(pinned)
  const countOf = (owner: string, repo: string): number =>
    atWork.find((one) => one.owner === owner && one.repo === repo)?.count ?? 0

  const listed: ReadonlyArray<Standing> = (
    searching
      ? matching(repositories, typed).map((one) => ({
          owner: one.owner,
          repo: one.repo,
          count: countOf(one.owner, one.repo)
        }))
      : atWork
  ).filter((one) => !held.has(`${one.owner}/${one.repo}`))

  /*
   * The pinned repositories, drawn from the addresses rather than from a read.
   *
   * A pin outlives whatever list it was made from: the repository read may not have landed
   * yet, and the repository may have no pull request in it this month, which is the whole
   * point of having pinned it.
   */
  const kept: ReadonlyArray<Standing> = pinned.flatMap((address) => {
    const [owner, repo] = address.split("/")
    if (owner === undefined || repo === undefined) return []
    return [{ owner, repo, count: countOf(owner, repo) }]
  })

  const pinning = (address: string) => onPinned?.(withPinToggled(pinned, address))

  // A zero beside a Destination is a claim that it holds nothing, which is a different thing
  // from not having read it yet, so each count says nothing until its read lands.
  const countFor = (which: Destination): number | undefined =>
    which === "working-set"
      ? needsYou
      : which === "activity"
        ? happened
        : repositories.length === 0
          ? undefined
          : repositories.length

  return (
    <nav aria-label="Rail" className="d-gleft">
      <div className="d-lefth">
        {DESTINATIONS.map((one) => {
          const many = countFor(one.which)
          const here = one.which === destination
          return (
            <button
              key={one.which}
              type="button"
              onClick={() => goTo(one.which)}
              aria-current={here ? "page" : undefined}
              aria-label={many === undefined ? one.name : `${one.name}, ${many}`}
              className="d-gchip"
            >
              <span aria-hidden="true">{one.short}</span>
              {many === undefined || one.which === "activity" ? null : (
                <span aria-hidden="true" className="d-n">
                  {many}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="d-rows">
        {repositories.length <= FILTERED_PAST ? null : (
          <label htmlFor={filterId} className="d-search d-rail-filter">
            <art.search size={13} aria-hidden="true" />
            <span className="sr-only">Filter your repositories</span>
            <input
              id={filterId}
              type="search"
              value={typed}
              placeholder="Filter repositories"
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setTyped("")
                  event.currentTarget.blur()
                }
              }}
            />
          </label>
        )}

        {kept.length === 0 || searching ? null : (
          <List
            name="Repositories you pinned"
            heading="Pinned"
            standings={kept}
            pinned={held}
            onPin={onPinned === undefined ? undefined : pinning}
          />
        )}

        {listed.length === 0 ? (
          searching ? (
            <p className="d-sect">
              Nothing matches {typed.trim()}, of {repositories.length}.
            </p>
          ) : null
        ) : (
          <List
            name={searching ? "Repositories that match" : "Repositories you are working in"}
            heading={searching ? `${listed.length} of ${repositories.length}` : "Your work"}
            standings={listed}
            pinned={held}
            onPin={onPinned === undefined ? undefined : pinning}
          />
        )}
      </div>
    </nav>
  )
}
