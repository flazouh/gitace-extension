import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { forgetEverything, installStorage, stored } from "../../tests/storage"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer } from "./GitHubGateway"

/**
 * The diff a pull request opens on, read before the press and found by the screen.
 *
 * Through the real gateway, the real store and `fetch` intercepted: what matters is how
 * many times GitHub is asked, which only the requests themselves can say.
 */

installStorage()
beforeEach(forgetEverything)

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const draft: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }

const entry = (path: string) => ({
  path,
  isBinary: false,
  isTooBig: false,
  truncatedReason: null,
  diffLines: [
    { type: "HUNK", text: "@@ -1 +1 @@", left: null, right: null },
    { type: "ADDITION", text: "+it spins", left: null, right: 1 }
  ]
})

const intercept = (): Array<string> => {
  const asked: Array<string> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input))
    asked.push(url.searchParams.get("paths") ?? "")
    const paths = decodeURIComponent(url.searchParams.get("paths") ?? "").split(",")
    return Promise.resolve(Response.json(paths.map(entry)))
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return asked
}

const diffs = (head: string, paths: ReadonlyArray<string>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const gateway = yield* GitHubGateway
      return yield* gateway.diffs(draft, head, paths)
    }).pipe(Effect.provide(layer))
  )

const keptFor = async (head: string, path: string): Promise<void> => {
  const key = `route:/microsoft/vscode/pull/327442/page_data/diff_entries?paths=${encodeURIComponent(encodeURIComponent(path))}&ctx=${encodeURIComponent(":::")}&w=0&range=${head}`
  for (let tries = 0; tries < 50 && stored(key) === undefined; tries += 1) await Promise.resolve()
  for (let tries = 0; tries < 50 && stored(key) === undefined; tries += 1) await Bun.sleep(0)
}

describe("one file's diff, asked for alone", () => {
  test("is asked of GitHub once, and found the second time", async () => {
    const asked = intercept()

    await diffs("abc123", ["src/spin.ts"])
    await keptFor("abc123", "src/spin.ts")
    const [again] = await diffs("abc123", ["src/spin.ts"])

    expect(asked).toHaveLength(1)
    expect(again?.diff.lines).toHaveLength(2)
  })

  test("is asked again for another head, whose diff may differ", async () => {
    const asked = intercept()

    await diffs("abc123", ["src/spin.ts"])
    await keptFor("abc123", "src/spin.ts")
    await diffs("def456", ["src/spin.ts"])

    expect(asked).toHaveLength(2)
  })

  test("is not kept when asked for beside others, which is the warming of a whole rail", async () => {
    const asked = intercept()

    await diffs("abc123", ["a.ts", "b.ts"])
    await diffs("abc123", ["a.ts", "b.ts"])

    expect(asked).toHaveLength(2)
  })
})
