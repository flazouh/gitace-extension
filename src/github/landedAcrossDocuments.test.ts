import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Fiber, Option } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import { forgetEverything, installStorage, place, stored } from "../../tests/storage"
import { rememberLanded } from "./cache"
import { forgetLanded, landedState, recordLanded, seeded } from "./landed"
import { GitHubGateway } from "../ports/GitHubGateway"
import { layer } from "./GitHubGateway"

/**
 * The map is per document and the reader's browsing is not.
 *
 * Close a pull request on Home, open GitHub in a new tab, and their search index
 * is still minutes behind — so the new document reads a list calling it open, and
 * without anything carried across it has no idea a press ever happened. The row
 * goes back under Needs You, which is the same complaint the press was about.
 */
const one = { owner: "flazouh", repo: "gitace-extension", number: 7 }

beforeEach(() => {
  installStorage()
  forgetEverything()
  forgetLanded()
})

afterEach(() => {
  forgetEverything()
  forgetLanded()
})

describe("a write carried from one document to the next", () => {
  test("writes down what the map holds", async () => {
    recordLanded(one, "closed")

    await Effect.runPromise(rememberLanded({ "flazouh/gitace-extension#7": { state: "closed", at: Date.now() } }))

    expect(stored("landed")).toEqual({
      "flazouh/gitace-extension#7": { state: "closed", at: expect.any(Number) }
    })
  })

  test("puts it back before the first read decodes", async () => {
    // The store as the last document left it, and a map that knows nothing.
    place("landed", { "flazouh/gitace-extension#7": { state: "closed", at: Date.now() } })

    expect(Option.isNone(landedState(one))).toBe(true)

    await Effect.runPromise(seeded)

    expect(landedState(one)).toEqual(Option.some("closed"))
  })

  test("asks the store once, however many reads want it", async () => {
    let asks = 0
    // The store as the code under test reaches it: the browser API, replaced
    // underneath rather than injected, which is the trick every test here plays.
    const local = (
      globalThis as unknown as {
        readonly browser: {
          readonly storage: {
            readonly local: {
              get: (keys: string | Array<string>) => PromiseLike<Record<string, unknown>>
            }
          }
        }
      }
    ).browser.storage.local

    const real = local.get
    local.get = (keys) => {
      asks += 1
      return real(keys)
    }

    place("landed", { "flazouh/gitace-extension#7": { state: "closed", at: Date.now() } })

    // The six shelves decode together, and each of them joins the same read
    // rather than starting one.
    await Effect.runPromise(Effect.all([seeded, seeded, seeded, seeded, seeded, seeded]))

    expect(asks).toBe(1)
    expect(landedState(one)).toEqual(Option.some("closed"))
  })

  test("a shelf read wears it, on the first list the new document draws", async () => {
    /*
     * End to end, through the gateway, because the seam between the map and the
     * decode is where this went wrong the first time: the overlay existed and the
     * listing decode was not waiting for it.
     */
    place("landed", {
      "octo-org/octo-repo#1457": { state: "closed", at: Date.now() }
    })

    const realFetch = globalThis.fetch
    globalThis.fetch = Object.assign(
      () =>
        Promise.resolve(
          Response.json({
            payload: {
              pullsInboxSurfaceContentRoute: {
                results: [
                  {
                    id: "PR_kwDOABCDE84AAAAB",
                    number: 1457,
                    title: "price claude turns from the streamed usage",
                    repoNameWithOwner: "octo-org/octo-repo",
                    permalink: "https://github.com/octo-org/octo-repo/pull/1457",
                    author: { displayLogin: "flazouh" },
                    // GitHub's own list, still calling it open.
                    state: "OPEN",
                    isDraft: false,
                    isReadByCurrentUser: true,
                    commentCount: 4,
                    createdAt: "2026-07-28T19:43:33+02:00",
                    updatedAt: "2026-07-29T04:19:41+02:00",
                    headSha: "0f95bb9db765f8134a8c33b4f6ecbdb21666e32e",
                    category: "CI_FAILING",
                    labels: [],
                    assignees: []
                  }
                ]
              }
            }
          })
        ),
      { preconnect: realFetch.preconnect }
    )

    const involved = await Effect.runPromise(
      Effect.gen(function* () {
        const gateway = yield* GitHubGateway
        return yield* gateway.workingSet("needs-action")
      }).pipe(Effect.provide(layer))
    )

    globalThis.fetch = realFetch

    expect(involved[0]?.state).toBe("closed")
  })

  /*
   * Chrome's store answers in the order it was asked. A pull request opened cold asks it
   * for the copy kept from the last visit, which is large, and for this, which is one
   * small key. Asked for only once GitHub had answered, this queued behind the kept copy,
   * and the live read waited on it: measured on a 27-file pull request, up to 240ms.
   */
  test("is not queued behind the kept copy a cold pull request reads first", async () => {
    const local = (
      globalThis as unknown as {
        readonly browser: {
          readonly storage: {
            readonly local: {
              get: (keys: string | Array<string>) => PromiseLike<Record<string, unknown>>
            }
          }
        }
      }
    ).browser.storage.local
    const real = local.get
    let inOrder: Promise<unknown> = Promise.resolve()
    let keptAnswered = false
    local.get = (keys) => {
      const small = keys === "landed" || (Array.isArray(keys) && keys.length === 1 && keys[0] === "landed")
      const answer = inOrder.then(
        () => new Promise<void>((done) => setTimeout(done, small ? 0 : 60)).then(() => real(keys))
      )
      inOrder = answer
      if (!small) void answer.then(() => (keptAnswered = true))
      return answer
    }

    const payloadFor = (url: string): unknown => {
      if (url.includes("/changes")) return draftWithBotFindings.changes
      if (url.includes("status_checks")) return draftWithBotFindings.statusChecks
      if (url.includes("description")) return draftWithBotFindings.description
      if (url.includes("page_data/header")) return draftWithBotFindings.header
      if (url.includes("issue_comments")) return draftWithBotFindings.issueComments
      if (url.includes("preview_stack")) return null
      return draftWithBotFindings.mergeBox
    }
    const realFetch = globalThis.fetch
    globalThis.fetch = Object.assign(
      (input: RequestInfo | URL) =>
        new Promise<Response>((answer) =>
          setTimeout(() => answer(Response.json(payloadFor(String(input)))), 10)
        ),
      { preconnect: realFetch.preconnect }
    )
    const draft = { owner: "microsoft", repo: "vscode", number: 327442 }
    const asking = <A, E>(read: (gateway: GitHubGateway["Service"]) => Effect.Effect<A, E>) =>
      Effect.runFork(Effect.flatMap(GitHubGateway, read).pipe(Effect.provide(layer)))

    // In the order the screen starts them: the live read, then the kept copy.
    const live = asking((gateway) => gateway.snapshot(draft))
    asking((gateway) => gateway.remembered(draft))
    await Effect.runPromise(Fiber.join(live))
    const keptWhenLive = keptAnswered

    globalThis.fetch = realFetch
    local.get = real

    expect(keptWhenLive).toBe(false)
  })

  test("goes on reading where there is no store to read", async () => {
    // A browser that has taken the permission away, and every test that has not
    // stood one up. A miss here is a map that stays empty, never a failure.
    Reflect.deleteProperty(globalThis, "browser")

    await Effect.runPromise(seeded)

    expect(Option.isNone(landedState(one))).toBe(true)
  })
})
