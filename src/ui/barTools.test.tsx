import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen } from "@testing-library/react"
import { BarTools, IntoTheBar } from "./barTools"
import { ScreenActivityProvider } from "./screenActivity"

const observing = globalThis.ResizeObserver
afterEach(() => {
  cleanup()
  globalThis.ResizeObserver = observing
})

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

  test("step out of a bar too narrow for them, and back in when it has room again", () => {
    const watching: Array<() => void> = []
    globalThis.ResizeObserver = class {
      constructor(private readonly heard: () => void) {
        watching.push(() => this.heard())
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    const sized = (element: Element, scroll: number, client: number) => {
      Object.defineProperty(element, "scrollWidth", { configurable: true, value: scroll })
      Object.defineProperty(element, "clientWidth", { configurable: true, value: client })
    }
    const resized = () => act(() => watching.forEach((heard) => heard()))

    render(
      <header data-testid="bar">
        <BarTools />
        <IntoTheBar>
          <button type="button">Repository filter</button>
        </IntoTheBar>
      </header>
    )
    const bar = screen.getByTestId("bar")
    const filter = () => screen.getByRole("button", { name: "Repository filter" })
    const inTheBar = () => document.querySelector("[data-bar-tools]")?.contains(filter()) ?? false

    sized(bar, 1333, 1251)
    resized()
    expect(inTheBar()).toBe(false)

    sized(bar, 1300, 1300)
    resized()
    expect(inTheBar()).toBe(false)

    sized(bar, 1340, 1340)
    resized()
    expect(inTheBar()).toBe(true)
  })
})
