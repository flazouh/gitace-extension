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

  test("lists pinned repositories as quick badges in the middle of the rail", () => {
    render(
      <GlobalRail
        where={{ kind: "repository", owner: "oven-sh", repo: "bun" }}
        pinned={["oven-sh/bun", "flazouh/ace"]}
        repositories={[repository("oven-sh/bun"), repository("flazouh/ace")]}
      />
    )

    const nav = rail()
    expect(within(nav).getByRole("link", { name: "oven-sh/bun" }).getAttribute("href")).toBe("/oven-sh/bun/pulls")
    expect(within(nav).getByRole("link", { name: "flazouh/ace" }).getAttribute("href")).toBe("/flazouh/ace/pulls")
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

    const leave = within(rail()).getByRole("button", { name: "GitHub interface" })
    await person.click(leave)
    expect(steppedAside).toBe(1)
  })
})
