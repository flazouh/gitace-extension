import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { BarTools, IntoTheBar } from "./barTools"
import { ScreenActivityProvider } from "./screenActivity"

afterEach(cleanup)

describe("a screen's controls in the bar", () => {
  test("stand in the bar for the screen that is showing", () => {
    render(
      <>
        <BarTools />
        <IntoTheBar>
          <button type="button">Repository filter</button>
        </IntoTheBar>
      </>
    )

    const slot = document.querySelector("[data-bar-tools]")
    expect(slot?.contains(screen.getByRole("button", { name: "Repository filter" }))).toBe(true)
  })

  test("stay out of it for a screen kept behind the one showing", () => {
    render(
      <>
        <BarTools />
        <ScreenActivityProvider active={false}>
          <IntoTheBar>
            <button type="button">Home's filter</button>
          </IntoTheBar>
        </ScreenActivityProvider>
        <IntoTheBar>
          <button type="button">Repository filter</button>
        </IntoTheBar>
      </>
    )

    expect(screen.queryByRole("button", { name: "Home's filter" })).toBeNull()
    expect(screen.getByRole("button", { name: "Repository filter" })).toBeDefined()
  })
})
