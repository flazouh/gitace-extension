import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
import { FileBrowser } from "./FileBrowser"
import { DEFAULT_KEYS } from "../keys/commands"

afterEach(cleanup)

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 2,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})

const browsing = (...paths: ReadonlyArray<string>) =>
  render(
    <FileBrowser
      files={paths.map(file)}
      fetchDiffs={() => Effect.succeed([])}
      diff={diffChoices(DEFAULTS.diff)}
      tree={treeChoices(DEFAULTS.tree)}
      keys={DEFAULT_KEYS}
    />
  )

/** The drawing of one file, whether or not it is the one being looked at. */
const drawingOf = (path: string): HTMLElement | null =>
  document.querySelector(`[data-file="${path}"]`)

const shown = (path: string): boolean => drawingOf(path)?.getAttribute("aria-hidden") === "false"

const open = () => screen.getByLabelText("Open file").textContent

describe("the file after the one being read", () => {
  test("is drawn before anyone asks for it", async () => {
    // Opening a file costs a parse, a highlight and a few thousand elements —
    // a third of a second on a real pull request, spent inside the keypress
    // that asked for it. Spent while the reader is reading instead, the same
    // work is free.
    browsing("src/one.ts", "src/two.ts")

    await waitFor(() => expect(drawingOf("src/two.ts")).not.toBeNull())
    expect(shown("src/two.ts")).toBe(false)
    // Held at opacity zero with its layout kept, not `contentVisibility:
    // hidden`: waking a deferred layout on the switch was itself a dropped
    // frame, measured on the zero-frame-drops branch this style landed from.
    expect(drawingOf("src/two.ts")?.style.opacity).toBe("0")
    expect(drawingOf("src/two.ts")?.style.contentVisibility).toBe("")
    expect(drawingOf("src/two.ts")?.hidden).toBe(false)
    expect(shown("src/one.ts")).toBe(true)
  })

  test("is that same drawing when it is asked for, not a second one", async () => {
    browsing("src/one.ts", "src/two.ts")
    await waitFor(() => expect(drawingOf("src/two.ts")).not.toBeNull())
    const already = drawingOf("src/two.ts")

    await userEvent.keyboard("s")

    expect(drawingOf("src/two.ts")).toBe(already)
    expect(shown("src/two.ts")).toBe(true)
    expect(drawingOf("src/two.ts")?.style.contentVisibility).toBe("")
    expect(drawingOf("src/two.ts")?.hidden).toBe(false)
    expect(open()).toContain("two.ts")
  })

  test("leaves the file behind it drawn, since going back is half of a review", async () => {
    browsing("src/one.ts", "src/two.ts")
    await waitFor(() => expect(drawingOf("src/two.ts")).not.toBeNull())
    const first = drawingOf("src/one.ts")

    await userEvent.keyboard("s")

    expect(drawingOf("src/one.ts")).toBe(first)
    expect(shown("src/one.ts")).toBe(false)
  })

  test("keeps only what is within reach, so a long review does not fill the tab", async () => {
    // Two hundred files drawn at once is a tab that has to be closed. One
    // either side is what a keypress can reach, and is therefore all that is
    // worth holding.
    browsing("a.ts", "b.ts", "c.ts", "d.ts", "e.ts")

    await userEvent.keyboard("ss")
    // The neighbours arrive one quiet moment at a time, and the cut back to
    // what a key reaches is the last of those moments — so the settled set is
    // what to wait for, not the first arrival.
    await waitFor(() => {
      expect(drawingOf("d.ts")).not.toBeNull()
      expect(document.querySelectorAll("[data-file]")).toHaveLength(3)
    })

    expect(drawingOf("a.ts")).toBeNull()
    expect(shown("c.ts")).toBe(true)
  })
})

describe("the diffs GitHub held back", () => {
  /*
   * Measured on a 27-file pull request: the file on the screen went out at the front of a
   * batch of ten and answered in 978ms, where one file alone answers in about 400.
   */
  test("asks for the file on the screen by itself, before the window around it", async () => {
    const asked: Array<ReadonlyArray<string>> = []
    const heldBack = (path: string): ChangedFile => ({ ...file(path), diff: Option.none() })
    render(
      <FileBrowser
        files={["a.ts", "b.ts", "c.ts"].map(heldBack)}
        fetchDiffs={(paths) =>
          Effect.sync(() => {
            asked.push(paths)
            return []
          })
        }
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys={DEFAULT_KEYS}
      />
    )

    await waitFor(() => expect(asked.flat()).toContain("c.ts"))
    expect(asked[0]).toEqual(["a.ts"])
    expect(asked.slice(1).flat()).not.toContain("a.ts")
  })
})
