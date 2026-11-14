import { Option } from "effect"
import { type ReactNode, useState } from "react"
import type { Destination } from "../domain/Settings"
import { THE_HOME } from "../domain/pages"
import type { Repository } from "../domain/repositories"
import { useArt } from "./art"
import type { Where } from "./Bar"
import { goTo } from "./going"
import { askHomeFor } from "./homeAsked"
import { Menu, type Row } from "./Menu"
import { participantRows } from "./participant"
import { RailTip, RailTips } from "./RailTip"
import { openTab } from "../app/openTab"
import { useKeyboard } from "./useKeyboard"
import { useKeys } from "./useKeys"

export type GlobalRailProps = {
  readonly where: Where
  readonly at?: string
  /** How many notifications are unread, where the page has counted them. */
  readonly unread?: number
  readonly needsYou?: number
  readonly repositories?: ReadonlyArray<Repository>
  readonly pinned?: ReadonlyArray<string>
  /** The Destination Home is showing now. */
  readonly destination?: Destination
  /** Home's own switch between its Destinations, handed in only on Home, which answers a press in place. */
  readonly onDestination?: (destination: Destination) => void
  readonly onHome?: () => void
  readonly onStepAside?: () => void
  /** The repository the reader is most at work in, where a new issue or pull request lands. */
  readonly aimAt?: { readonly owner: string; readonly repo: string }
  /** Who the reader is, for the avatar and its menu at the foot. */
  readonly participant?: { readonly login: string; readonly faceUrl: Option.Option<string> }
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

/** A count in a button's corner, for what is waiting behind it. Past 99 it stops being a number to read. */
const Count = ({ of }: { readonly of: number }) =>
  of > 0 ? (
    <span aria-hidden="true" className="d-count">
      {of > 99 ? "99+" : of}
    </span>
  ) : null

/** A pressed modifier is the reader asking for a new tab, which the link already does. */
const plainPress = (event: React.MouseEvent): boolean =>
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)

export const GlobalRail = ({
  where,
  at = typeof window === "undefined" ? "/" : window.location.pathname,
  unread = 0,
  needsYou = 0,
  repositories = [],
  pinned = NONE,
  destination = "working-set",
  onDestination,
  onHome,
  onStepAside,
  aimAt,
  participant,
  settings
}: GlobalRailProps) => {
  const art = useArt()
  const Issue = art.issue
  const Repos = art.files
  const Clock = art.clock
  const Bell = art.notifications
  const Create = art.create
  const Settings = art.diff
  const GitHub = art.github
  const [opened, setOpened] = useState<"create" | "account" | undefined>(undefined)

  const onWorkingSet =
    where.kind === "home" && destination === "working-set" && (at === "/" || at.startsWith("/pulls"))
  const onIssues = at.startsWith("/issues")
  const onRepos = where.kind === "home" && destination === "repositories"
  const onActivity = where.kind === "home" && destination === "activity"
  const onNotifications = at.startsWith("/notifications")

  /*
   * A Destination is a link to Home, so from the inbox or a pull request it goes there the way any link
   * does, carrying which Destination was pressed. Only Home switches in place. The press never moves
   * the setting Home opens on: that is the reader's choice in settings, not the last button they hit.
   */
  const home = (): void => {
    if (onHome !== undefined) onHome()
    else goTo(window, THE_HOME)
  }
  const reach = (which: Destination): void => {
    if (onDestination !== undefined) return onDestination(which)
    askHomeFor(which)
    home()
  }
  const toDestination = (which: Destination) => (event: React.MouseEvent) => {
    if (!plainPress(event)) return
    event.preventDefault()
    reach(which)
  }
  /*
   * The rail's chords on every screen, because the rail is on every screen. Home alone used to
   * answer them, and everywhere else GitHub's own `g i` and `g d` loaded a document of theirs.
   */
  useKeys(useKeyboard(), {
    workingSet: () => reach("working-set"),
    repositories: () => reach("repositories"),
    activity: () => reach("activity"),
    issues: () => goTo(window, "/issues"),
    notifications: () => goTo(window, "/notifications"),
    home
  })

  const [pinnedOwner, pinnedRepo] = pinned[0]?.split("/") ?? []
  const aimedAt =
    aimAt ??
    (pinnedOwner !== undefined && pinnedRepo !== undefined
      ? { owner: pinnedOwner, repo: pinnedRepo }
      : repositories[0])

  return (
    <RailTips>
      <nav
        aria-label="Global navigation"
        data-gitace-global-rail=""
        className="d-rail fixed left-1 top-1 bottom-1 z-30"
      >
        {/*
         * The mark is the Working Set: Home's first page, and the one `github.com/` was replaced by.
         * A second button for it below drew one place twice.
         */}
        <RailTip name="Working Set" keys="g d">
          <a
            href={THE_HOME}
            aria-label={needsYou > 0 ? `Working Set, ${needsYou} waiting on you` : "Working Set"}
            aria-current={onWorkingSet ? "page" : undefined}
            onClick={toDestination("working-set")}
            data-gitace-in-place=""
            className="d-nv d-home"
          >
            <AceMark />
            <Count of={needsYou} />
          </a>
        </RailTip>

        <RailTip name="Issues" keys="g i">
          <a
            href="/issues"
            aria-label="Issues"
            aria-current={onIssues ? "page" : undefined}
            className="d-nv"
          >
            <Issue size={16} />
          </a>
        </RailTip>

        <RailTip name="Repositories" keys="g r">
          <a
            href={THE_HOME}
            onClick={toDestination("repositories")}
            data-gitace-in-place=""
            aria-label="Repositories"
            aria-current={onRepos ? "page" : undefined}
            className="d-nv"
          >
            <Repos size={16} />
          </a>
        </RailTip>

        <RailTip name="Activity" keys="g f">
          <a
            href={THE_HOME}
            onClick={toDestination("activity")}
            data-gitace-in-place=""
            aria-label="Activity"
            aria-current={onActivity ? "page" : undefined}
            className="d-nv"
          >
            <Clock size={16} />
          </a>
        </RailTip>

        <RailTip name="Notifications" keys="g n">
          <a
            href="/notifications"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            aria-current={onNotifications ? "page" : undefined}
            className="d-nv"
          >
            <Bell size={16} />
            <Count of={unread} />
          </a>
        </RailTip>

        <span aria-hidden="true" className="d-sp" />

        <div className="relative">
          <RailTip name="Create">
            <button
              type="button"
              onClick={() => setOpened(opened === "create" ? undefined : "create")}
              aria-haspopup="menu"
              aria-expanded={opened === "create"}
              aria-label="Create"
              className="d-nv"
            >
              <Create size={16} />
            </button>
          </RailTip>
          <Menu
            name="Create"
            origin="beside"
            open={opened === "create"}
            onShut={() => setOpened(undefined)}
            rows={creatingFor(aimedAt)}
          />
        </div>

        {settings === undefined
          ? null
          : settings((open, isOpen) => (
              <RailTip name="Ace settings">
                <button
                  type="button"
                  onClick={open}
                  aria-label="Ace settings"
                  aria-expanded={isOpen}
                  className="d-nv"
                >
                  <Settings size={16} />
                </button>
              </RailTip>
            ))}

        {participant === undefined ? null : (
          <div className="relative">
            <RailTip name={participant.login}>
              <button
                type="button"
                onClick={() => setOpened(opened === "account" ? undefined : "account")}
                aria-haspopup="menu"
                aria-expanded={opened === "account"}
                aria-label={`${participant.login} and your account`}
                className="d-nv"
              >
                <span className="d-avatar">
                  {Option.match(participant.faceUrl, {
                    onNone: () => participant.login.slice(0, 2),
                    onSome: (url) => <img src={url} alt="" />
                  })}
                </span>
              </button>
            </RailTip>
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
          <RailTip name="GitHub interface">
            <button
              type="button"
              onClick={onStepAside}
              aria-label="Leave Ace"
              className="d-nv"
            >
              <GitHub size={16} />
            </button>
          </RailTip>
        )}
      </nav>
    </RailTips>
  )
}
