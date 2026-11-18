import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { AcrossUse, Ledger, Writing } from "../ports/Ledger"
import type { DiffHandle, DiffRequest } from "../ports/Renderer"
import type { Store } from "../ports/Settings"
import type { Changes } from "../domain/changes"
import { DEFAULTS } from "../domain/Settings"
import { LedgerProvider } from "./ledger"
import { RendererProvider, type LoadEngine } from "./renderer"
import { SettingsProvider } from "./settings"
import { UsesPanel } from "./UsesPanel"

/**
 * The panel on a pull request: what the head says about the change, which files
 * it tags, and which lines the preview marks as added.
 *
 * Drawn on its own rather than through a pane, because the pull request's diffs
 * are what is being stood in for and a pane would only pass them through.
 */

afterEach(cleanup)

const writing: Writing = {
  name: "shape",
  kind: "function",
  line: 2,
  from: 14,
  to: 19,
  signature: "export const shape = () => 1",
  doc: null,
  sure: true
}

const HERE = ["// the file being read", "export const shape = () => 1", "", "shape()"].join("\n")

const FILES: Readonly<Record<string, string>> = {
  "src/added.ts": ['import { shape } from "./one"', "", "export const twice = () => shape() * 2"].join("\n"),
  "src/old.ts": ['import { shape } from "./one"', "", "export const kept = () => shape()"].join("\n")
}

const stage = (uses: ReadonlyArray<AcrossUse>, changes: Changes) => {
  const drew: Array<DiffRequest> = []
  const handle: DiffHandle = {
    onThemeChange: () => {},
    showNotes: () => {},
    unpick: () => {},
    mark: () => {},
    boundsOf: () => null,
    destroy: () => {}
  }
  const renderer: LoadEngine = Effect.succeed({
    warm: () => Effect.void,
    renderDiff: (_container: HTMLElement, request: DiffRequest) => {
      drew.push(request)
      return handle
    }
  })
  const ledger: Ledger = {
    ready: () => Effect.void,
    writingAt: () => Effect.succeed(Option.none()),
    writingNamed: () => Effect.succeed(Option.none()),
    borrowedAs: () => Effect.succeed(Option.none()),
    writingsIn: () => Effect.succeed([]),
    usesIn: () => Effect.succeed([{ line: 2, from: 14, to: 19 }]),
    beyond: () => Effect.succeed({ why: "nothing there" }),
    usesAcross: () => Effect.succeed({ ready: true, uses }),
    warm: () => Effect.succeed({ ready: true, read: 0, skipped: 0 }),
    namesLike: () => Effect.succeed({ places: [], ready: true })
  }
  const settings: Store = { read: Effect.succeed(DEFAULTS), write: () => Effect.void, watch: () => () => {} }

  const tree = (changes: Changes) => (
    <SettingsProvider store={settings}>
      <RendererProvider load={renderer}>
        <LedgerProvider ledger={ledger}>
          <UsesPanel
            writing={writing}
            reading={{ path: "src/one.ts", text: HERE }}
            at={{ top: 400, left: 40, bottom: 416, right: 90 }}
            under={writing.line}
            onGo={() => false}
            onClose={() => {}}
            across={{
              repo: { owner: "octo-org", repo: "octo-repo" },
              sha: "abc123",
              read: (path) => Effect.succeed(FILES[path] ?? "")
            }}
            changes={changes}
          />
        </LedgerProvider>
      </RendererProvider>
    </SettingsProvider>
  )
  const { rerender } = render(tree(changes))
  return { drew, again: (next: Changes) => rerender(tree(next)) }
}

const across = (path: string, line: number, imported = false): AcrossUse => ({
  path,
  line,
  from: 1,
  to: 6,
  sure: true,
  ...(imported ? { imported: true as const } : {})
})

/** A pull request that changed `src/added.ts`, adding every line of it. */
const changes: Changes = {
  paths: new Set(["src/one.ts", "src/added.ts"]),
  added: (path) => Effect.succeed(new Set(path === "src/added.ts" ? [1, 2, 3] : []))
}

describe("the uses of a name on a pull request", () => {
  test("says how many of the uses the pull request added", async () => {
    stage([across("src/added.ts", 1, true), across("src/added.ts", 3), across("src/old.ts", 3)], changes)

    expect(await screen.findByText("3 uses in 2 files · 2 added by this PR")).toBeTruthy()
  })

  test("says when it added all of them, and when it touched none", async () => {
    stage([across("src/added.ts", 3)], changes)
    expect(await screen.findByText("1 use in 1 file · all added by this PR")).toBeTruthy()
    cleanup()

    stage([across("src/old.ts", 3)], changes)
    expect(await screen.findByText("1 use in 1 file · none touched by this PR")).toBeTruthy()
  })

  test("counts again when the pull request gets a new commit", async () => {
    const { again } = stage([across("src/added.ts", 3)], changes)
    await screen.findByText("1 use in 1 file · all added by this PR")

    again({ paths: changes.paths, added: () => Effect.succeed(new Set()) })
    expect(await screen.findByText("1 use in 1 file · none touched by this PR")).toBeTruthy()
  })

  test("tags a file the pull request changed, where not every file listed is one", async () => {
    stage([across("src/added.ts", 3), across("src/old.ts", 3)], changes)

    await screen.findByText("2 uses in 2 files · 1 added by this PR")
    const tag = screen.getByText("in this PR")
    expect(tag.closest("div")?.querySelector('[title="src/added.ts"]')).not.toBeNull()
    expect(screen.getAllByText("in this PR")).toHaveLength(1)
  })

  test("marks the lines the pull request added in the preview of another file", async () => {
    const { drew } = stage([across("src/added.ts", 3)], changes)

    const row = (await screen.findByText("export const twice = () => shape() * 2")).closest("button")
    await userEvent.hover(row!)

    await waitFor(() => expect(drew.at(-1)?.path).toBe("src/added.ts"))
    expect(drew.at(-1)?.patch).toContain("+export const twice = () => shape() * 2")
    expect(drew.at(-1)?.patch).toContain('+import { shape } from "./one"')
  })
})
