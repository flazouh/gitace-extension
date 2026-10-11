/**
 * How wide the two parts of a pull request's page are, and how the handle between them moves the line.
 *
 * The left part holds the description, the checks, the conversation, the commits and the merge; the right
 * holds the files. They share one row, and the left has a width of its own that the reader sets: the right
 * takes what is left. Every number here is in rem, which is what the width is kept in, so that a reader who
 * made their text larger gets a column that grew with it.
 */

import { ABOUT_WIDTH_LEAST, ABOUT_WIDTH_MOST, DEFAULT_ABOUT_WIDTH } from "../domain/Settings"

/** The least the files panel keeps: narrower and a diff of a hundred columns has no room to be read. */
export const FILES_LEAST = 24

/** The gap between the two parts, which is the handle's own width (`w-1.5`). */
export const HANDLE = 0.375

/** One arrow key, and one arrow key with Shift held. */
export const STEP = 1
export const STRIDE = 4

/**
 * The widest the left part can be in a row `row` rem wide: what the files panel does not need, and never past
 * the limit the setting keeps. A row too narrow for both leaves the left at its least; the files panel then
 * gives way, as it always has in a window that small.
 */
export const widest = (row: number): number =>
  Math.max(ABOUT_WIDTH_LEAST, Math.min(ABOUT_WIDTH_MOST, row - FILES_LEAST - HANDLE))

/** A width held between the least and what the row allows; the row is `undefined` before it has been measured. */
export const held = (rem: number, row?: number): number => {
  const most = row === undefined ? ABOUT_WIDTH_MOST : widest(row)
  return Math.round(Math.min(most, Math.max(ABOUT_WIDTH_LEAST, rem)) * 10) / 10
}

/** How many pixels one rem is on this page, which is what a width in rem is moved by. */
export const remPixels = (): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

/** The width a pointer at `x` asks for, in a row that starts at `left`, a rem being `rem` pixels. */
export const widthAt = (x: number, left: number, rem: number): number => (x - left - (HANDLE * rem) / 2) / rem

/**
 * What a key asks for, or `undefined` for a key the handle does not answer.
 *
 * Arrows move the line by one rem, four with Shift; Home and End take it to either end of its travel; Enter
 * puts it back where it started. The right arrow gives the left part more, as the line moves right.
 */
export const asked = (key: string, shift: boolean, current: number, row?: number): number | undefined => {
  const by = shift ? STRIDE : STEP
  switch (key) {
    case "ArrowRight":
      return held(current + by, row)
    case "ArrowLeft":
      return held(current - by, row)
    case "Home":
      return ABOUT_WIDTH_LEAST
    case "End":
      return held(ABOUT_WIDTH_MOST, row)
    case "Enter":
      return held(DEFAULT_ABOUT_WIDTH, row)
    default:
      return undefined
  }
}
