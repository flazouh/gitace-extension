import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { GlobalRail } from "./GlobalRail"

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
  test("draws the Ace mark at the top and the five Option 1 surfaces below it", () => {
    render(<GlobalRail where={{ kind: "home" }} />)

    const nav = rail()
    expect(within(nav).getByLabelText("Ace")).toBeDefined()
    expect(within(nav).getByLabelText("Working Set").getAttribute("href")).toBe("/")
    expect(within(nav).getByLabelText("Issues").getAttribute("href")).toBe("/issues")
    expect(within(nav).getByLabelText("Repositories")).toBeDefined()
    expect(within(nav).getByLabelText("Activity")).toBeDefined()
    expect(within(nav).getByLabelText("Notifications").getAttribute("href")).toBe("/notifications")
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

  test("marks the Working Set when something is waiting on the reader", () => {
    render(<GlobalRail where={{ kind: "home" }} needsYou={2} />)

    const item = within(rail()).getByLabelText("Working Set")
    expect(item.querySelector(".d-dot")).not.toBeNull()
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

describe("the sidebar control", () => {
  test("hides Home's left column, and says it will show it once hidden", async () => {
    const person = userEvent.setup()
    const pressed: Array<boolean> = []
    const { rerender } = render(
      <GlobalRail where={{ kind: "home" }} sidebar={{ open: true, toggle: () => pressed.push(true) }} />
    )

    await person.click(within(rail()).getByRole("button", { name: "Hide the sidebar" }))
    expect(pressed).toEqual([true])

    rerender(<GlobalRail where={{ kind: "home" }} sidebar={{ open: false, toggle: () => {} }} />)
    expect(within(rail()).getByRole("button", { name: "Show the sidebar" })).toBeDefined()
  })

  test("is not offered where there is no left column", () => {
    render(<GlobalRail where={{ kind: "repository", owner: "oven-sh", repo: "bun" }} />)

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
