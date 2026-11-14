import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { GlobalRail } from "./GlobalRail"
import { takeHomeAsked } from "./homeAsked"

afterEach(cleanup)

const rail = () => screen.getByRole("navigation", { name: "Global navigation" })

const repository = (nameWithOwner: string) => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false
  }
}

describe("the persistent global Ace rail", () => {
  test("opens on the mark, which is the Working Set, and lists five pages with nothing drawn twice", () => {
    render(<GlobalRail where={{ kind: "home" }} at="/" />)

    const pages = within(rail()).getAllByRole("link")
    expect(pages.map((one) => one.getAttribute("aria-label"))).toEqual([
      "Working Set",
      "Issues",
      "Repositories",
      "Activity",
      "Notifications"
    ])
    expect(pages[0]!.classList.contains("d-home")).toBe(true)
    expect(pages[0]!.getAttribute("href")).toBe("/")
    expect(pages[0]!.getAttribute("aria-current")).toBe("page")
    expect(pages[1]!.getAttribute("href")).toBe("/issues")
    expect(pages[4]!.getAttribute("href")).toBe("/notifications")
  })

  test("holds no pinned repositories, which Home's left column lists with their counts", () => {
    render(
      <GlobalRail
        where={{ kind: "repository", owner: "oven-sh", repo: "bun" }}
        pinned={["oven-sh/bun", "flazouh/ace"]}
        repositories={[repository("oven-sh/bun"), repository("flazouh/ace")]}
      />
    )

    expect(within(rail()).queryByRole("link", { name: "oven-sh/bun" })).toBeNull()
  })

  test("offers the GitHub interface toggle at the bottom-left of the rail", async () => {
    const person = userEvent.setup()
    let steppedAside = 0

    render(
      <GlobalRail
        where={{ kind: "repository", owner: "oven-sh", repo: "bun" }}
        onStepAside={() => {
          steppedAside += 1
        }}
      />
    )

    const leave = within(rail()).getByRole("button", { name: "Leave GitAce Extension" })
    await person.click(leave)
    expect(steppedAside).toBe(1)
  })

  test("counts what is waiting on the reader on the mark, and what is unread on Notifications", () => {
    render(<GlobalRail where={{ kind: "home" }} needsYou={2} unread={14} />)

    const mark = within(rail()).getByRole("link", { name: "Working Set, 2 waiting on you" })
    expect(mark.textContent).toBe("2")
    const bell = within(rail()).getByRole("link", { name: "Notifications, 14 unread" })
    expect(bell.textContent).toBe("14")
  })

  test("draws no count where nothing is waiting, and stops counting past 99", () => {
    render(<GlobalRail where={{ kind: "home" }} needsYou={0} unread={240} />)

    expect(within(rail()).getByRole("link", { name: "Working Set" }).textContent).toBe("")
    expect(within(rail()).getByRole("link", { name: /^Notifications/ }).textContent).toBe("99+")
  })

  test("names a button in a tooltip of ours beside it, with its keys, and not in the browser's", async () => {
    const person = userEvent.setup()
    render(<GlobalRail where={{ kind: "home" }} onStepAside={() => undefined} />)

    for (const item of within(rail()).getAllByRole("link").concat(within(rail()).getAllByRole("button"))) {
      expect(item.getAttribute("title")).toBeNull()
    }

    await person.hover(within(rail()).getByLabelText("Repositories"))
    const tip = await screen.findByRole("tooltip")
    expect(tip.textContent).toBe("Repositories g r")
  })

  test("names every page's keys, the mark's being the Working Set's", async () => {
    const said: Array<string> = []
    for (const name of ["Working Set", "Issues", "Notifications"]) {
      render(<GlobalRail where={{ kind: "home" }} />)
      await userEvent.setup().hover(within(rail()).getByLabelText(name))
      said.push((await screen.findByRole("tooltip")).textContent ?? "")
      cleanup()
    }
    expect(said).toEqual(["Working Set g d", "Issues g i", "Notifications g n"])
  })

  test("answers its chords away from Home, by asking Home for the Destination", async () => {
    let homed = 0
    render(
      <GlobalRail
        where={{ kind: "repository", owner: "oven-sh", repo: "bun" }}
        onHome={() => {
          homed += 1
        }}
      />
    )

    await userEvent.setup().keyboard("gf")
    expect(homed).toBe(1)
    expect(takeHomeAsked()).toBe("activity")

    await userEvent.setup().keyboard("gg")
    expect(homed).toBe(2)
    expect(takeHomeAsked()).toBeUndefined()
  })

  test("switches Home's Destination in place on Home, without asking for a page", async () => {
    const reached: Array<string> = []
    let homed = 0
    render(
      <GlobalRail
        where={{ kind: "home" }}
        onDestination={(which) => reached.push(which)}
        onHome={() => {
          homed += 1
        }}
      />
    )

    await userEvent.setup().keyboard("grgd")
    expect(reached).toEqual(["repositories", "working-set"])
    expect(homed).toBe(0)
  })
})

/**
 * Starting something, from the rail.
 *
 * "There is no button to create a new repository any more" is its own ask in their thread. An
 * issue and a pull request need a repository to be in, so they aim at the first one pinned.
 */
describe("the create action", () => {
  test("aims at the repository the reader is most at work in, before any pin", async () => {
    const person = userEvent.setup()
    render(
      <GlobalRail
        where={{ kind: "home" }}
        pinned={["oven-sh/bun"]}
        aimAt={{ owner: "flazouh", repo: "ace" }}
      />
    )

    await person.click(within(rail()).getByRole("button", { name: "Create" }))

    expect(screen.getByRole("menuitem", { name: "New issue in ace" }).getAttribute("href")).toBe(
      "/flazouh/ace/issues/new"
    )
  })

  test("offers a repository, an issue and a pull request in the first pinned repository", async () => {
    const person = userEvent.setup()
    render(<GlobalRail where={{ kind: "home" }} pinned={["oven-sh/bun"]} />)

    await person.click(within(rail()).getByRole("button", { name: "Create" }))

    const menu = screen.getByRole("menu", { name: "Create" })
    expect(within(menu).getByRole("menuitem", { name: /repository/i })).toBeDefined()
    expect(
      within(menu).getByRole("menuitem", { name: "New issue in bun" }).getAttribute("href")
    ).toBe("/oven-sh/bun/issues/new")
    expect(
      within(menu).getByRole("menuitem", { name: "New pull request in bun" }).getAttribute("href")
    ).toBe("/oven-sh/bun/compare")
  })
})

/**
 * What the face at the foot of the rail is for.
 *
 * GitHub's own account menu is thirty rows, most of them somewhere nobody goes on a working
 * day. The three here are the ones the spec names; the way back to GitHub is its own button.
 */
describe("the Participant menu", () => {
  const me = { login: "flazouh", faceUrl: Option.none<string>() }

  test("holds the three rows and the way to report a problem", async () => {
    const person = userEvent.setup()
    render(<GlobalRail where={{ kind: "home" }} participant={me} />)

    await person.click(screen.getByRole("button", { name: /flazouh and your account/ }))

    const menu = screen.getByRole("menu", { name: "Your account" })
    expect(within(menu).getAllByRole("menuitem").map((one) => one.textContent)).toEqual([
      "Your profile",
      "GitHub settings",
      "Sign out",
      "Report a problem"
    ])
    expect(within(menu).getByRole("menuitem", { name: "Your profile" }).getAttribute("href")).toBe(
      "/flazouh"
    )
    expect(within(menu).getByRole("menuitem", { name: "Sign out" }).getAttribute("href")).toBe("/logout")
    expect(within(menu).queryByRole("menuitem", { name: /Leave|GitHub interface/ })).toBeNull()
  })

  test("opens the problem report in a new tab", async () => {
    const asked: Array<unknown> = []
    const prior = (globalThis as unknown as { browser?: unknown }).browser
    ;(globalThis as unknown as { browser: unknown }).browser = {
      runtime: {
        sendMessage: (message: unknown) => {
          asked.push(message)
          return Promise.resolve()
        }
      }
    }
    const person = userEvent.setup()
    render(<GlobalRail where={{ kind: "home" }} participant={me} />)

    await person.click(screen.getByRole("button", { name: /flazouh and your account/ }))
    await person.click(screen.getByRole("menuitem", { name: "Report a problem" }))
    ;(globalThis as unknown as { browser?: unknown }).browser = prior

    expect(asked).toEqual([
      { kind: "gitace/open-tab", url: "https://github.com/flazouh/gitace-extension/issues" }
    ])
  })

  test("shuts on Escape", async () => {
    const person = userEvent.setup()
    render(<GlobalRail where={{ kind: "home" }} participant={me} />)

    await person.click(screen.getByRole("button", { name: /flazouh/ }))
    await person.keyboard("{Escape}")

    expect(screen.queryByRole("menu", { name: "Your account" })).toBeNull()
  })

  test("is not drawn at all when nobody is signed in", () => {
    render(<GlobalRail where={{ kind: "home" }} />)

    expect(screen.queryByRole("button", { name: /your account/ })).toBeNull()
  })
})

/**
 * A Destination pressed is a visit, never the place Home opens.
 *
 * It used to write the setting, so a glance at Activity moved where `github.com/` landed the
 * next morning. Only Settings move that now.
 */
describe("a Destination pressed", () => {
  afterEach(() => sessionStorage.clear())

  test("switches Home in place, through Home's own switch", async () => {
    const person = userEvent.setup()
    const went: Array<string> = []
    render(<GlobalRail where={{ kind: "home" }} onDestination={(which) => went.push(which)} />)

    const loads: Array<boolean> = []
    const heard = (event: Event) => loads.push(!event.defaultPrevented)
    document.addEventListener("click", heard)
    await person.click(within(rail()).getByRole("link", { name: "Activity" }))
    document.removeEventListener("click", heard)

    expect(went).toEqual(["activity"])
    expect(loads).toEqual([false])
    expect(sessionStorage.length).toBe(0)
  })

  test("off Home, is carried to Home once, and the shell's Home is opened rather than the page", async () => {
    // The shell claims a link of ours on `pointerdown` and stops its click before React
    // sees it, so every Destination is marked as answered in place.
    const person = userEvent.setup()
    const went: Array<string> = []
    render(
      <GlobalRail
        where={{ kind: "repository", owner: "oven-sh", repo: "bun" }}
        at="/issues"
        onHome={() => went.push("home")}
      />
    )
    const activity = within(rail()).getByRole("link", { name: "Activity" })

    await person.click(activity)

    expect(activity.hasAttribute("data-gitace-in-place")).toBe(true)
    expect(went).toEqual(["home"])
    expect(takeHomeAsked()).toBe("activity")
    expect(takeHomeAsked()).toBeUndefined()
  })

  test("off Home on a page, walks to Home itself rather than loading the document", async () => {
    const person = userEvent.setup()
    window.history.replaceState(null, "", "/issues")
    render(<GlobalRail where={{ kind: "repository", owner: "oven-sh", repo: "bun" }} at="/issues" />)

    const loads: Array<boolean> = []
    const heard = (event: Event) => loads.push(!event.defaultPrevented)
    document.addEventListener("click", heard)
    await person.click(within(rail()).getByRole("link", { name: "Repositories" }))
    document.removeEventListener("click", heard)

    expect(loads).toEqual([false])
    expect(window.location.pathname).toBe("/")
    expect(takeHomeAsked()).toBe("repositories")
  })

  test("leaves the left column's control to the column, out of the rail", () => {
    render(<GlobalRail where={{ kind: "home" }} />)

    expect(within(rail()).queryByRole("button", { name: /the sidebar/ })).toBeNull()
  })
})

describe("the way into the settings", () => {
  test("is the rail's own control, handed to the sheet that opens", async () => {
    const person = userEvent.setup()
    let opened = 0
    render(
      <GlobalRail
        where={{ kind: "home" }}
        settings={(trigger) => trigger(() => (opened += 1), false)}
      />
    )

    await person.click(within(rail()).getByRole("button", { name: "GitAce settings" }))
    expect(opened).toBe(1)
  })
})
