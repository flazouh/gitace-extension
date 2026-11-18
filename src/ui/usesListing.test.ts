import { describe, expect, test } from "bun:test"
import { languageOf, listing, shortPath, summary, type Hit } from "./usesListing"

const use = (path: string, line: number, over: Partial<Hit> = {}): Hit => ({
  path,
  line,
  written: false,
  sure: true,
  imported: false,
  ...over
})

const ALL = { imports: true, tests: true }

describe("the list of a name's uses, by file", () => {
  test("puts the file being read first, then the code, then the tests, each in name order", () => {
    const hits = [
      use("src/zeta.test.ts", 4),
      use("src/beta.ts", 9),
      use("src/here.ts", 30, { written: true }),
      use("src/alpha.test.ts", 2),
      use("src/alpha.ts", 7),
      use("src/here.ts", 12)
    ]

    expect(listing(hits, "src/here.ts", ALL).groups.map((group) => group.path)).toEqual([
      "src/here.ts",
      "src/alpha.ts",
      "src/beta.ts",
      "src/alpha.test.ts",
      "src/zeta.test.ts"
    ])
  })

  test("lists a file's rows in line order", () => {
    const hits = [use("src/one.ts", 40), use("src/one.ts", 3), use("src/one.ts", 17)]
    expect(listing(hits, "src/one.ts", ALL).groups[0]?.hits.map((hit) => hit.line)).toEqual([3, 17, 40])
  })

  test("holds back imports and tests when asked, but never where the name is written", () => {
    const hits = [
      use("src/one.test.ts", 1, { written: true }),
      use("src/barrel.ts", 1, { imported: true }),
      use("src/code.ts", 5),
      use("src/code.test.ts", 8)
    ]

    const listed = listing(hits, "src/code.ts", { imports: false, tests: false })
    expect(listed.groups.map((group) => group.path)).toEqual(["src/code.ts", "src/one.test.ts"])
    expect(listed.uses).toHaveLength(1)
    expect(listed.hidden).toBe(2)
    // What each box would hold back, whatever it says now — and the Writing is neither.
    expect([listed.imports, listed.tests]).toEqual([1, 1])
  })
})

describe("what the head says about the list", () => {
  test("counts uses and files, in the singular where there is one", () => {
    expect(summary([use("a.ts", 1)], 0)).toBe("1 use in 1 file")
    expect(summary([use("a.ts", 1), use("a.ts", 2)], 0)).toBe("2 uses in 1 file")
    expect(summary([use("a.ts", 1), use("b.ts", 2)], 0)).toBe("2 uses in 2 files")
    expect(summary([], 0)).toBe("no uses")
  })

  test("says how much of it the pull request added, where there is one", () => {
    const uses = [use("a.ts", 1), use("b.ts", 2), use("c.ts", 3)]
    expect(summary(uses, 0, 3)).toBe("3 uses in 3 files · all added by this PR")
    expect(summary(uses, 0, 1)).toBe("3 uses in 3 files · 1 added by this PR")
    expect(summary(uses, 0, 0)).toBe("3 uses in 3 files · none touched by this PR")
    expect(summary(uses, 0)).toBe("3 uses in 3 files")
  })

  test("says how many the boxes hold back", () => {
    expect(summary([use("a.ts", 1)], 2, 0)).toBe("1 use in 1 file · none touched by this PR · 2 hidden")
    expect(summary([], 3)).toBe("no uses · 3 hidden")
  })
})

describe("what a row is drawn with", () => {
  test("names a file by its last folder and its name", () => {
    expect(shortPath("apps/desktop/src/shared/rpc/session-import.ts")).toBe("rpc/session-import.ts")
    expect(shortPath("README.md")).toBe("README.md")
  })

  test("colours the languages the highlighter carries, and leaves the rest plain", () => {
    expect(languageOf("src/one.tsx")).toBe("typescript")
    expect(languageOf("src/one.mjs")).toBe("javascript")
    expect(languageOf("main.go")).toBe("")
  })
})
