import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
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

describe("Home with the persistent global rail", () => {
  test("keeps the gleft repository sidebar wide even when home.rail was narrow, so two icon rails never stack", async () => {
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

    const rail = await waitFor(() => screen.getByRole("navigation", { name: "Rail" }))
    expect(rail.getAttribute("data-narrow")).toBeNull()
    expect(within(rail).getByRole("button", { name: /Working Set/ }).textContent).toContain("Working Set")
  })
})
