import { afterEach, describe, expect, mock, test } from "bun:test"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef } from "react"
import { ABOUT_WIDTH_LEAST, ABOUT_WIDTH_MOST, DEFAULT_ABOUT_WIDTH } from "@/domain/Settings"
import { ColumnHandle } from "./ColumnHandle"

afterEach(cleanup)

/** A row that starts at the left of the window and is 1600 px wide, which is 100 rem at 16 px. */
const aRow = () => {
  const row = document.createElement("div")
  row.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1600, bottom: 800, width: 1600, height: 800, x: 0, y: 0, toJSON: () => ({}) })
  const ref = createRef<HTMLElement>()
  ;(ref as { current: HTMLElement | null }).current = row
  return ref
}

/** The pointer moving, or letting go, as the browser tells the strip that captured it. */
const moved = (handle: HTMLElement, x: number) => act(() => handle.onpointermove?.({ clientX: x } as PointerEvent))
const released = (handle: HTMLElement) => act(() => handle.onpointerup?.({} as PointerEvent))

const handled = (width = 26, rowRem: number | undefined = 100) => {
  const onChange = mock((_: number) => {})
  const onRest = mock((_: number) => {})
  render(<ColumnHandle width={width} row={aRow()} rowRem={rowRem} onChange={onChange} onRest={onRest} />)
  return { onChange, onRest, handle: screen.getByRole("separator", { name: "How wide the conversation is" }) }
}

describe("the handle between the two parts", () => {
  test("is a vertical separator that says how wide the left part is and how far it can go", () => {
    const { handle } = handled(30, 100)

    expect(handle.getAttribute("aria-orientation")).toBe("vertical")
    expect(handle.getAttribute("aria-valuenow")).toBe("30")
    expect(handle.getAttribute("aria-valuemin")).toBe(String(ABOUT_WIDTH_LEAST))
    expect(handle.getAttribute("aria-valuemax")).toBe(String(ABOUT_WIDTH_MOST))
    expect(handle.tabIndex).toBe(0)
  })

  test("says what the row allows once the row is narrow", () => {
    const { handle } = handled(26, 55)

    expect(Number(handle.getAttribute("aria-valuemax"))).toBeLessThan(ABOUT_WIDTH_MOST)
  })

  test("moves with the arrow keys, and keeps the width at once", async () => {
    const { handle, onChange, onRest } = handled(26)
    handle.focus()

    await userEvent.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenLastCalledWith(27)
    expect(onRest).toHaveBeenLastCalledWith(27)

    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}")
    expect(onChange).toHaveBeenLastCalledWith(22)
    expect(onRest).toHaveBeenLastCalledWith(22)
  })

  test("goes to either end with Home and End, and back to the start with Enter", async () => {
    const { handle, onRest } = handled(30)
    handle.focus()

    await userEvent.keyboard("{Home}")
    expect(onRest).toHaveBeenLastCalledWith(ABOUT_WIDTH_LEAST)
    await userEvent.keyboard("{End}")
    expect(onRest).toHaveBeenLastCalledWith(ABOUT_WIDTH_MOST)
    await userEvent.keyboard("{Enter}")
    expect(onRest).toHaveBeenLastCalledWith(DEFAULT_ABOUT_WIDTH)
  })

  test("keeps the keys it answers from the page, and lets the others through", () => {
    const { handle } = handled(26)
    const seen = mock((_: KeyboardEvent) => {})
    document.addEventListener("keydown", seen)

    fireEvent.keyDown(handle, { key: "ArrowRight" })
    expect(seen).not.toHaveBeenCalled()
    fireEvent.keyDown(handle, { key: "j" })
    expect(seen).toHaveBeenCalledTimes(1)

    document.removeEventListener("keydown", seen)
  })

  test("goes back to the start on a double press", () => {
    const { handle, onChange, onRest } = handled(40)

    fireEvent.doubleClick(handle)

    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_ABOUT_WIDTH)
    expect(onRest).toHaveBeenLastCalledWith(DEFAULT_ABOUT_WIDTH)
  })

  test("follows the pointer while it is dragged and keeps the width once, when it lets go", () => {
    const { handle, onChange, onRest } = handled(26)

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 420 })
    expect(handle.hasAttribute("data-dragging")).toBe(true)
    moved(handle, 16 * 30 + 3)
    expect(onChange).toHaveBeenLastCalledWith(30)
    moved(handle, 16 * 33 + 3)
    expect(onChange).toHaveBeenLastCalledWith(33)
    expect(onRest).not.toHaveBeenCalled()

    released(handle)
    expect(onRest).toHaveBeenCalledTimes(1)
    expect(handle.hasAttribute("data-dragging")).toBe(false)
  })

  test("never follows the pointer past either end of its travel", () => {
    const { handle, onChange } = handled(26)

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 420 })
    moved(handle, 0)
    expect(onChange).toHaveBeenLastCalledWith(ABOUT_WIDTH_LEAST)
    moved(handle, 1600)
    expect(onChange).toHaveBeenLastCalledWith(ABOUT_WIDTH_MOST)
  })

  test("is moved by the first button only", () => {
    const { handle } = handled(26)

    fireEvent.pointerDown(handle, { button: 2, pointerId: 1, clientX: 420 })

    expect(handle.hasAttribute("data-dragging")).toBe(false)
    expect(handle.onpointermove).toBeNull()
  })
})
