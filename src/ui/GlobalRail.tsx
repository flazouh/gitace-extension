import { Option } from "effect"
import type { Destination } from "../domain/Settings"
import { THE_HOME } from "../domain/pages"
import type { Repository } from "../domain/repositories"
import { useArt } from "./art"
import type { Where } from "./Bar"
import { HERE } from "./dress"
import { Face } from "./Face"

export type GlobalRailProps = {
  readonly where: Where
  readonly at?: string
  readonly unread?: boolean
  readonly needsYou?: number
  readonly repositories?: ReadonlyArray<Repository>
  readonly pinned?: ReadonlyArray<string>
  readonly destination?: Destination
  readonly onDestination?: (destination: Destination) => void
  readonly onHome?: () => void
  readonly onStepAside?: () => void
}

const NONE: ReadonlyArray<string> = []

const AceMark = () => (
  <svg viewBox="0 0 120 82" aria-hidden="true" className="w-[18px] h-auto block">
    <path
      fill="currentColor"
      d="M43.7 81.4H0L85.7 0H120v81.4H76.9L61.6 64.7 43.7 81.4Zm29.2-32.2h24.4V24.6L72.9 49.2Z"
    />
  </svg>
)

const ITEM =
  "relative grid size-8 shrink-0 place-items-center rounded-md text-ink-muted no-underline transition-colors hover:bg-hover hover:text-ink"

export const GlobalRail = ({
  where,
  at = typeof window === "undefined" ? "/" : window.location.pathname,
  unread = false,
  needsYou = 0,
  repositories = [],
  pinned = NONE,
  destination = "working-set",
  onDestination,
  onHome,
  onStepAside
}: GlobalRailProps) => {
  const art = useArt()
  const PullRequest = art["pull-request"]
  const Issue = art.issue
  const Repos = art.repositories
  const Clock = art.clock
  const Inbox = unread ? art["notifications-unread"] : art.notifications
  const GitHub = art.github

  const onWorkingSet =
    where.kind === "home" && destination === "working-set" && (at === "/" || at.startsWith("/pulls"))
  const onIssues = at.startsWith("/issues")
  const onRepos = where.kind === "home" && destination === "repositories"
  const onActivity = where.kind === "home" && destination === "activity"
  const onNotifications = at.startsWith("/notifications")

  const faceOf = (owner: string, repo: string): Option.Option<string> =>
    repositories.find((one) => one.owner === owner && one.repo === repo)?.faceUrl ?? Option.none()

  const goDestination = (which: Destination) => {
    if (onDestination !== undefined) {
      onDestination(which)
      return
    }
    if (onHome !== undefined) {
      onHome()
      return
    }
    window.location.assign(THE_HOME)
  }

  return (
    <nav
      aria-label="Global navigation"
      data-gitace-global-rail=""
      className="fixed left-1 top-1 bottom-1 z-30 flex w-8 flex-col items-center gap-1"
    >
      {onHome !== undefined ? (
        <button
          type="button"
          onClick={onHome}
          aria-label="Ace"
          title="Ace"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink hover:bg-hover"
        >
          <AceMark />
        </button>
      ) : (
        <a
          href={THE_HOME}
          aria-label="Ace"
          title="Ace"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink no-underline hover:bg-hover"
        >
          <AceMark />
        </a>
      )}

      <a
        href={THE_HOME}
        aria-label="Working Set"
        title="Working Set (g d)"
        aria-current={onWorkingSet ? "page" : undefined}
        onClick={
          onDestination === undefined
            ? undefined
            : (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                onDestination("working-set")
              }
        }
        className={`${ITEM} ${onWorkingSet ? `${HERE} text-ink` : ""}`}
      >
        <PullRequest size={16} />
        {needsYou > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 size-1.5 rounded-full bg-busy"
          />
        ) : null}
      </a>

      <a
        href="/issues"
        aria-label="Issues"
        title="Issues"
        aria-current={onIssues ? "page" : undefined}
        className={`${ITEM} ${onIssues ? `${HERE} text-ink` : ""}`}
      >
        <Issue size={16} />
      </a>

      <button
        type="button"
        onClick={() => goDestination("repositories")}
        aria-label="Repositories"
        title="Repositories (g r)"
        aria-current={onRepos ? "page" : undefined}
        className={`${ITEM} ${onRepos ? `${HERE} text-ink` : ""}`}
      >
        <Repos size={16} />
      </button>

      <button
        type="button"
        onClick={() => goDestination("activity")}
        aria-label="Activity"
        title="Activity (g f)"
        aria-current={onActivity ? "page" : undefined}
        className={`${ITEM} ${onActivity ? `${HERE} text-ink` : ""}`}
      >
        <Clock size={16} />
      </button>

      <a
        href="/notifications"
        aria-label="Notifications"
        title="Notifications"
        aria-current={onNotifications ? "page" : undefined}
        className={`${ITEM} ${onNotifications ? `${HERE} text-ink` : ""}`}
      >
        <Inbox size={16} />
        {unread ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 size-1.5 rounded-full bg-busy"
          />
        ) : null}
      </a>

      {pinned.length === 0 ? null : (
        <>
          <span aria-hidden="true" className="my-0.5 h-px w-4 bg-line" />
          {pinned.slice(0, 5).map((address) => {
            const [owner = "", repo = ""] = address.split("/")
            if (owner === "" || repo === "") return null
            const activeRepo =
              where.kind === "repository" && where.owner === owner && where.repo === repo
            return (
              <a
                key={address}
                href={`/${owner}/${repo}/pulls`}
                aria-label={address}
                title={address}
                aria-current={activeRepo ? "location" : undefined}
                className={`${ITEM} ${activeRepo ? `${HERE} text-ink` : ""}`}
              >
                <Face faceUrl={faceOf(owner, repo)} name={repo} />
              </a>
            )
          })}
        </>
      )}

      <span aria-hidden="true" className="flex-1" />

      {onStepAside === undefined ? null : (
        <button
          type="button"
          onClick={onStepAside}
          aria-label="GitHub interface"
          title="GitHub interface · Leave GitAce Extension"
          className={ITEM}
        >
          <GitHub size={16} />
        </button>
      )}
    </nav>
  )
}
