import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect, Option } from "effect"
import { DEFAULTS } from "../domain/Settings"
import { sittingsIn } from "../domain/sittings"
import type { Store } from "../ports/Settings"
import { Home } from "./Home"
import { SettingsProvider } from "./settings"

afterEach(cleanup)

const storeWithNarrowRail: Store = {
  read: Effect.succeed({
    ...DEFAULTS,
    home: { ...DEFAULTS.home, rail: "narrow" }
  }),
  write: () => Effect.void,
  watch: () => () => {}
}

const showingHome = () =>
  render(
    <SettingsProvider store={storeWithNarrowRail}>
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
