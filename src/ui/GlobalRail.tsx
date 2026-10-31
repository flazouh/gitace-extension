import { Option } from "effect"
import { type ReactNode, useState } from "react"
import type { Destination } from "../domain/Settings"
import { THE_HOME } from "../domain/pages"
import type { Repository } from "../domain/repositories"
import { useArt } from "./art"
import type { Where } from "./Bar"
import { Menu, type Row } from "./Menu"
import { participantRows } from "./participant"
import { openTab } from "../app/openTab"

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
  /** The repository the reader is most at work in, where a new issue or pull request lands. */
  readonly aimAt?: { readonly owner: string; readonly repo: string }
  /** Who the reader is, for the avatar and its menu at the foot. */
  readonly participant?: { readonly login: string; readonly faceUrl: Option.Option<string> }
  /** Whether Home's left column is showing, and the press that shows or hides it. */
  readonly sidebar?: { readonly open: boolean; readonly toggle: () => void }
  /** The settings sheet, handed the control that opens it. */
  readonly settings?: (trigger: (open: () => void, opened: boolean) => ReactNode) => ReactNode
}

const NONE: ReadonlyArray<string> = []

const ISSUES_BOARD = "https://github.com/flazouh/gitace-extension/issues"

/** Who the reader is, and the one way to tell us something of ours is wrong. */
const accountRows = (login: string): ReadonlyArray<Row> => [
  ...participantRows({ login }),
  {
    name: "Report a problem",
    where: ISSUES_BOARD,
    art: "bug",
    // Background tabs.create — not window.open (popup-blocked) and not a same-tab Turbo walk
    // of target=_blank on github.com.
    press: () => openTab(ISSUES_BOARD)
  }
]

const AceMark = () => (
  <svg viewBox="0 0 120 82" aria-hidden="true">
    <defs>
      <linearGradient id="gitace-mark-clay" x1="0" y1="0" x2="0" y2="1">
        <stop className="d-top" offset="0" />
        <stop className="d-bottom" offset="1" />
      </linearGradient>
    </defs>
    <path className="d-ink" d="M43.7 81.4H0L85.7 0H120v81.4H76.9L61.6 64.7 43.7 81.4Zm29.2-32.2h24.4V24.6L72.9 49.2Z" />
    <path
      className="d-clay"
      fill="url(#gitace-mark-clay)"
      d="M43.7 81.4H0L85.7 0H120v81.4H76.9L61.6 64.7 43.7 81.4Zm29.2-32.2h24.4V24.6L72.9 49.2Z"
    />
  </svg>
)

/** Where a new repository, issue, pull request or gist is started from. */
const creatingFor = (aimedAt: { readonly owner: string; readonly repo: string } | undefined): ReadonlyArray<Row> => [
  { name: "New repository", where: "/new", art: "repositories" },
  ...(aimedAt === undefined
    ? []
    : [
        {
          name: `New issue in ${aimedAt.repo}`,
          where: `/${aimedAt.owner}/${aimedAt.repo}/issues/new`,
          art: "issue" as const
        },
        {
          name: `New pull request in ${aimedAt.repo}`,
          where: `/${aimedAt.owner}/${aimedAt.repo}/compare`,
          art: "pull-request" as const
        }
      ]),
  { name: "New gist", where: "https://gist.github.com/", art: "code" }
]

/** A pressed modifier is the reader asking for a new tab, which the link already does. */
const plainPress = (event: React.MouseEvent): boolean =>
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)

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
  onStepAside,
  aimAt,
  participant,
  sidebar,
  settings
}: GlobalRailProps) => {
  const art = useArt()
  const PullRequest = art["pull-request"]
  const Issue = art.issue
  const Repos = art.files
  const Clock = art.clock
  const Bell = art.notifications
  const Create = art.create
  const Sidebar = art.narrow
  const Settings = art.diff
  const GitHub = art.github
  const [opened, setOpened] = useState<"create" | "account" | undefined>(undefined)

  const onWorkingSet =
    where.kind === "home" && destination === "working-set" && (at === "/" || at.startsWith("/pulls"))
  const onIssues = at.startsWith("/issues")
  const onRepos = where.kind === "home" && destination === "repositories"
  const onActivity = where.kind === "home" && destination === "activity"
  const onNotifications = at.startsWith("/notifications")

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

  const [pinnedOwner, pinnedRepo] = pinned[0]?.split("/") ?? []
  const aimedAt =
    aimAt ??
    (pinnedOwner !== undefined && pinnedRepo !== undefined
      ? { owner: pinnedOwner, repo: pinnedRepo }
      : repositories[0])

  return (
    <nav
      aria-label="Global navigation"
      data-gitace-global-rail=""
      className="d-rail fixed left-1 top-1 bottom-1 z-30"
    >
      {onHome !== undefined ? (
        <button type="button" onClick={onHome} aria-label="Ace" title="Ace" className="d-nv d-home">
          <AceMark />
        </button>
      ) : (
        <a href={THE_HOME} aria-label="Ace" title="Ace" className="d-nv d-home">
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
                if (!plainPress(event)) return
                event.preventDefault()
                onDestination("working-set")
              }
        }
        className="d-nv"
      >
        <PullRequest size={18} />
        {needsYou > 0 ? <span aria-hidden="true" className="d-dot" /> : null}
      </a>

      <a
        href="/issues"
        aria-label="Issues"
        title="Issues"
        aria-current={onIssues ? "page" : undefined}
        className="d-nv"
      >
        <Issue size={18} />
      </a>

      <button
        type="button"
        onClick={() => goDestination("repositories")}
        aria-label="Repositories"
        title="Repositories (g r)"
        aria-current={onRepos ? "page" : undefined}
        className="d-nv"
      >
        <Repos size={18} />
      </button>

      <button
        type="button"
        onClick={() => goDestination("activity")}
        aria-label="Activity"
        title="Activity (g f)"
        aria-current={onActivity ? "page" : undefined}
        className="d-nv"
      >
        <Clock size={18} />
      </button>

      <a
        href="/notifications"
        aria-label={unread ? "Notifications, something is waiting" : "Notifications"}
        title="Notifications"
        aria-current={onNotifications ? "page" : undefined}
        className="d-nv"
      >
        <Bell size={18} />
        {unread ? <span aria-hidden="true" className="d-dot" /> : null}
      </a>

      <span aria-hidden="true" className="d-sp" />

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpened(opened === "create" ? undefined : "create")}
          aria-haspopup="menu"
          aria-expanded={opened === "create"}
          aria-label="Create"
          title="Create"
          className="d-nv"
        >
          <Create size={18} />
        </button>
        <Menu
          name="Create"
          origin="beside"
          open={opened === "create"}
          onShut={() => setOpened(undefined)}
          rows={creatingFor(aimedAt)}
        />
      </div>

      {sidebar === undefined ? null : (
        <button
          type="button"
          onClick={sidebar.toggle}
          aria-pressed={sidebar.open}
          aria-label={sidebar.open ? "Hide the sidebar" : "Show the sidebar"}
          title={sidebar.open ? "Hide the sidebar ([)" : "Show the sidebar ([)"}
          className="d-nv"
        >
          <Sidebar size={18} />
        </button>
      )}

      {settings === undefined
        ? null
        : settings((open, isOpen) => (
            <button
              type="button"
              onClick={open}
              aria-label="GitAce settings"
              title="GitAce settings"
              aria-expanded={isOpen}
              className="d-nv"
            >
              <Settings size={18} />
            </button>
          ))}

      {participant === undefined ? null : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpened(opened === "account" ? undefined : "account")}
            aria-haspopup="menu"
            aria-expanded={opened === "account"}
            aria-label={`${participant.login} and your account`}
            title={participant.login}
            className="d-nv"
          >
            <span className="d-avatar">
              {Option.match(participant.faceUrl, {
                onNone: () => participant.login.slice(0, 2),
                onSome: (url) => <img src={url} alt="" />
              })}
            </span>
          </button>
          <Menu
            name="Your account"
            origin="beside"
            open={opened === "account"}
            onShut={() => setOpened(undefined)}
            rows={accountRows(participant.login)}
          />
        </div>
      )}

      {onStepAside === undefined ? null : (
        <button
          type="button"
          onClick={onStepAside}
          aria-label="Leave GitAce Extension"
          title="GitHub interface"
          className="d-nv"
        >
          <GitHub size={18} />
        </button>
      )}
    </nav>
  )
}
