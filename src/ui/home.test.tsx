import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { DEFAULTS } from "../domain/Settings"
import { sittingsIn } from "../domain/sittings"
import type { Settings } from "../domain/Settings"
import type { Store } from "../ports/Settings"
import { Home } from "./Home"
import { askHomeFor } from "./homeAsked"
import { SettingsProvider } from "./settings"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

const storeWithSidebarHidden: Store = {
  read: Effect.succeed({
    ...DEFAULTS,
    home: { ...DEFAULTS.home, sidebar: "hidden" }
  }),
  write: () => Effect.void,
  watch: () => () => {}
}

/** A store that keeps what is written to it, so a test can say what a press did and did not change. */
const keeping = (start: Settings) => {
  let held = start
  const written: Array<Settings> = []
  const heard = new Set<(settings: Settings) => void>()
  const store: Store = {
    read: Effect.sync(() => held),
    write: (next) =>
      Effect.sync(() => {
        held = next
        written.push(next)
        for (const one of heard) one(next)
      }),
    watch: (listener) => {
      heard.add(listener)
      return () => heard.delete(listener)
    }
  }
  return { store, written }
}

const showingHome = (store: Store = storeWithSidebarHidden) =>
  render(
    <SettingsProvider store={store}>
      <Home
        load={() => Effect.succeed(sittingsIn([], () => Option.none()))}
        repositories={() => Effect.succeed([])}
        activity={() => Effect.succeed([])}
        onOpen={() => {}}
        onStepAside={() => {}}
      />
    </SettingsProvider>
  )

describe("Home's left column", () => {
  test("stays put away once the reader hid it, so a reload does not bring it back", async () => {
    showingHome()

    await waitFor(() => expect(screen.getByText(/Nothing is waiting on you/)).toBeDefined())
    expect(screen.queryByRole("navigation", { name: "Rail" })).toBeNull()
  })
})

describe("Home's left column, put away and brought back", () => {
  test("is put away from its own header and brought back from the start of the bar", async () => {
    const person = userEvent.setup()
    const { store } = keeping(DEFAULTS)
    showingHome(store)

    const column = await screen.findByRole("navigation", { name: "Your repositories" })
    await person.click(within(column).getByRole("button", { name: "Hide the sidebar" }))
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Your repositories" })).toBeNull())

    await person.click(within(screen.getByRole("banner")).getByRole("button", { name: "Show the sidebar" }))
    await screen.findByRole("navigation", { name: "Your repositories" })
    expect(within(screen.getByRole("banner")).queryByRole("button", { name: "Show the sidebar" })).toBeNull()
  })
})

describe("where Home lands", () => {
  const crumb = () => within(screen.getByRole("banner")).getByText(/Working Set|Repositories|Activity/)

  test("is the setting, and a Destination pressed in the rail visits without moving it", async () => {
    const person = userEvent.setup()
    const { store, written } = keeping(DEFAULTS)
    showingHome(store)
    await waitFor(() => expect(crumb().textContent).toBe("Working Set"))

    await person.click(within(screen.getByRole("navigation", { name: "Global navigation" })).getByLabelText("Activity"))

    await waitFor(() => expect(crumb().textContent).toBe("Activity"))
    expect(written.map((one) => one.home.destination)).not.toContain("activity")
  })

  test("is the Destination a press away from Home asked for, once", async () => {
    askHomeFor("repositories")
    showingHome(keeping(DEFAULTS).store)

    await waitFor(() => expect(crumb().textContent).toBe("Repositories"))
    cleanup()

    showingHome(keeping(DEFAULTS).store)
    await waitFor(() => expect(crumb().textContent).toBe("Working Set"))
  })
})
