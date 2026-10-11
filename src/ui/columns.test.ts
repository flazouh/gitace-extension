import { describe, expect, it } from "bun:test"
import { ABOUT_WIDTH_LEAST, ABOUT_WIDTH_MOST, DEFAULT_ABOUT_WIDTH } from "@/domain/Settings"
import { asked, FILES_LEAST, HANDLE, held, STEP, STRIDE, widest, widthAt } from "./columns"

describe("how far the line between the two parts can go", () => {
  it("leaves the files panel its least, and never goes past the limit the setting keeps", () => {
    expect(widest(100)).toBe(ABOUT_WIDTH_MOST)
    expect(widest(60)).toBe(60 - FILES_LEAST - HANDLE)
    expect(widest(50)).toBeCloseTo(50 - FILES_LEAST - HANDLE, 6)
  })

  it("leaves the left part its least in a row too narrow for both", () => {
    expect(widest(30)).toBe(ABOUT_WIDTH_LEAST)
    expect(widest(0)).toBe(ABOUT_WIDTH_LEAST)
  })

  it("holds a width between the least and what the row allows, to a tenth", () => {
    expect(held(26, 100)).toBe(26)
    expect(held(5, 100)).toBe(ABOUT_WIDTH_LEAST)
    expect(held(99, 100)).toBe(ABOUT_WIDTH_MOST)
    expect(held(99, 60)).toBe(Math.round(widest(60) * 10) / 10)
    expect(held(26.04, 100)).toBe(26)
    expect(held(99)).toBe(ABOUT_WIDTH_MOST)
  })
})

describe("where the pointer puts the line", () => {
  it("measures from the row's left edge to the middle of the handle", () => {
    // 16 px to the rem; the handle is 0.375 rem, so its middle is 3 px in.
    expect(widthAt(16 * 26 + 3, 0, 16)).toBe(26)
    expect(widthAt(100 + 16 * 30 + 3, 100, 16)).toBe(30)
  })
})

describe("what a key asks of the handle", () => {
  it("moves the line by a rem with an arrow, and by four with Shift", () => {
    expect(asked("ArrowRight", false, 26, 100)).toBe(26 + STEP)
    expect(asked("ArrowLeft", false, 26, 100)).toBe(26 - STEP)
    expect(asked("ArrowRight", true, 26, 100)).toBe(26 + STRIDE)
    expect(asked("ArrowLeft", true, 26, 100)).toBe(26 - STRIDE)
  })

  it("stops at either end of the travel", () => {
    expect(asked("ArrowLeft", true, ABOUT_WIDTH_LEAST + 1, 100)).toBe(ABOUT_WIDTH_LEAST)
    expect(asked("ArrowRight", true, 46, 100)).toBe(ABOUT_WIDTH_MOST)
    expect(asked("ArrowRight", false, widest(60), 60)).toBe(Math.round(widest(60) * 10) / 10)
  })

  it("takes the line to an end with Home and End, and back to the start with Enter", () => {
    expect(asked("Home", false, 30, 100)).toBe(ABOUT_WIDTH_LEAST)
    expect(asked("End", false, 30, 100)).toBe(ABOUT_WIDTH_MOST)
    expect(asked("End", false, 30, 60)).toBe(Math.round(widest(60) * 10) / 10)
    expect(asked("Enter", false, 40, 100)).toBe(DEFAULT_ABOUT_WIDTH)
  })

  it("does not answer the keys that are the page's", () => {
    for (const key of ["a", "ArrowUp", "ArrowDown", "Tab", "Escape", " "]) {
      expect(asked(key, false, 30, 100)).toBeUndefined()
    }
  })
})
