import type { RepositoryAtWork } from "../domain/rail"
import { withPinToggled } from "../domain/repositories"
import { useArt } from "./art"
import { RepoTile } from "./Face"

/**
 * Home's left column: the repositories a reader actually goes to, as a way to narrow the list.
 *
 * Not a second set of Destinations. Those are the global rail's, a few pixels to the left, and
 * a row of chips here repeating them was two controls for one choice. Not a second search
 * either: the header's filter narrows the list and ⌘K finds any repository, so a box here was
 * a third field for the same question.
 *
 * A press on a row narrows Home to that repository in place, and a second press widens it
 * again. A press with a modifier is still the link it looks like, to the repository's pull
 * requests in a new tab.
 *
 * See `docs/spec/home.md`.
 */
export type RailProps = {
  /** Ranked by `repositoriesAtWork`; drawn in the order it is given. */
  readonly atWork: ReadonlyArray<RepositoryAtWork>
  /**
   * The repositories the reader pinned, as `owner/repo`, in the order they pinned them.
   *
   * Above the work rather than mixed into it, and unlimited: a reader who pinned a repository
   * has said it matters whether or not there is a pull request in it this week.
   */
  readonly pinned?: ReadonlyArray<string>
  readonly onPinned?: (pinned: ReadonlyArray<string>) => void
  /** The repositories the list is narrowed to, as `owner/repo`. */
  readonly chosen?: ReadonlyArray<string>
  /** Narrows the list to one repository, or widens it again. Absent, the rows are links. */
  readonly onChoose?: (address: string) => void
}

/** A repository as the Rail draws it, whichever of its two lists it is in. */
type Standing = {
  readonly owner: string
  readonly repo: string
  readonly count: number
}

const NOTHING: ReadonlyArray<string> = []

/** A pressed modifier is the reader asking for a new tab, which the link already does. */
const plainPress = (event: React.MouseEvent): boolean =>
  event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)

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
  chosen,
  onPin,
  onChoose
}: {
  readonly name: string
  readonly heading: string
  readonly standings: ReadonlyArray<Standing>
  readonly pinned: ReadonlySet<string>
  readonly chosen: ReadonlySet<string>
  readonly onPin?: (address: string) => void
  readonly onChoose?: (address: string) => void
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
          const on = chosen.has(address.toLowerCase())

          return (
            <li key={address} className={`d-gpr ${on ? "d-on" : ""}`}>
              <a
                href={`/${address}/pulls`}
                aria-label={one.count === 0 ? address : `${address}, ${one.count} open`}
                aria-current={on ? "true" : undefined}
                title={on ? `Show every repository` : `Show only ${address}`}
                onClick={
                  onChoose === undefined
                    ? undefined
                    : (event) => {
                        if (!plainPress(event)) return
                        event.preventDefault()
                        onChoose(address)
                      }
                }
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

export const Rail = ({ atWork, pinned = NOTHING, onPinned, chosen = NOTHING, onChoose }: RailProps) => {
  const held = new Set(pinned)
  const picked = new Set(chosen.map((one) => one.toLowerCase()))
  const countOf = (owner: string, repo: string): number =>
    atWork.find((one) => one.owner === owner && one.repo === repo)?.count ?? 0

  const listed = atWork.filter((one) => !held.has(`${one.owner}/${one.repo}`))

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

  return (
    <nav aria-label="Your repositories" className="d-gleft">
      <div className="d-lefth">
        <span className="d-lefth-title">Your repositories</span>
      </div>

      <div className="d-rows">
        {kept.length === 0 ? null : (
          <List
            name="Repositories you pinned"
            heading="Pinned"
            standings={kept}
            pinned={held}
            chosen={picked}
            onPin={onPinned === undefined ? undefined : pinning}
            onChoose={onChoose}
          />
        )}

        {listed.length === 0 ? null : (
          <List
            name="Repositories you are working in"
            heading="Your work"
            standings={listed}
            pinned={held}
            chosen={picked}
            onPin={onPinned === undefined ? undefined : pinning}
            onChoose={onChoose}
          />
        )}
      </div>
    </nav>
  )
}
