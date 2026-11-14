import { describe, expect, test } from "bun:test"
import { isTraversalOntoOurs } from "./navigationGuard"
import { isOurEntry, pushOurEntry, replaceKeepingOurs } from "./ourEntries"

/** A window whose history also keeps the Navigation API's state per entry, as a browser does. */
const aWindow = () => {
  const entries: Array<{ url: string; state: unknown; navigationState: unknown }> = [
    { url: "/honojs/hono", state: { __TSR_index: 0 }, navigationState: undefined }
  ]
  let at = 0
  const view = {
    history: {
      get state() {
        return entries[at]?.state
      },
      pushState: (state: unknown, _title: string, url: string) => {
        entries.splice(at + 1, entries.length, { url, state, navigationState: undefined })
        at += 1
      },
      replaceState: (state: unknown, _title: string, url: string) => {
        entries[at] = { url, state, navigationState: undefined }
      }
    },
    navigation: {
      get currentEntry() {
        return { getState: () => entries[at]?.navigationState }
      },
      updateCurrentEntry: ({ state }: { state: unknown }) => {
        const entry = entries[at]
        if (entry !== undefined) entry.navigationState = state
      }
    }
  }
  return { view: view as unknown as Window, entries }
}

const traversal = (sameDocument: boolean, state: unknown): Event =>
  Object.assign(new Event("navigate"), {
    navigationType: "traverse",
    destination: { url: "https://github.com/honojs/hono/issues", sameDocument, getState: () => state }
  })

describe("the entries this extension makes", () => {
  test("are marked where the page's router keeps nothing, and leave its record alone", () => {
    const { view, entries } = aWindow()

    pushOurEntry(view, "/honojs/hono/issues")

    expect(entries.map((entry) => entry.url)).toEqual(["/honojs/hono", "/honojs/hono/issues"])
    expect(isOurEntry(entries[1]?.navigationState)).toBe(true)
    expect(isOurEntry(entries[0]?.navigationState)).toBe(false)
    expect(entries[0]?.state).toEqual({ __TSR_index: 0 })
  })

  test("stay ours when the address moves to a line in place", () => {
    const { view, entries } = aWindow()
    pushOurEntry(view, "/honojs/hono/pull/1")

    replaceKeepingOurs(view, "/honojs/hono/pull/1#src/a.ts")

    expect(entries[1]?.url).toBe("/honojs/hono/pull/1#src/a.ts")
    expect(isOurEntry(entries[1]?.navigationState)).toBe(true)
  })

  test("do not turn one of the page's own entries into ours by moving it", () => {
    const { view, entries } = aWindow()

    replaceKeepingOurs(view, "/honojs/hono#readme")

    expect(isOurEntry(entries[0]?.navigationState)).toBe(false)
  })
})

describe("Back and Forward, as the page-world guard sees them", () => {
  test("onto one of ours, in this document, are kept from their router", () => {
    expect(isTraversalOntoOurs(traversal(true, { gitace: true }))).toBe(true)
  })

  test("onto one of theirs, or into another document, are theirs", () => {
    expect(isTraversalOntoOurs(traversal(true, undefined))).toBe(false)
    expect(isTraversalOntoOurs(traversal(true, { somethingElse: true }))).toBe(false)
    expect(isTraversalOntoOurs(traversal(false, { gitace: true }))).toBe(false)
  })
})
