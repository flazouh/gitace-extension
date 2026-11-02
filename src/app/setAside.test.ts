import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { InvolvedPullRequest } from "../domain/workingSet"
import { layer } from "../github/GitHubGateway"
import { pressingFor } from "./intent"
import { settingAside } from "./setAside"
import { sizesOf } from "./sizes"

/**
 * A list's columns giving way to the reader once they have moved on.
 *
 * Through the real gateway with `fetch` held open, the way the sizes are tested: what
 * matters is which reads reach GitHub, and a fake gateway would agree with anything.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const LIST = "/flazouh/stack-probe/pulls"

/** Every read waits until it is answered by hand, so a test can act between two of them. */
const holdOpen = () => {
  const asked: Array<string> = []
  const waiting: Array<() => void> = []
  const handler = (input: RequestInfo | URL): Promise<Response> => {
    asked.push(String(input).replace(/.*\/pull\/(\d+)\/.*/, "$1"))
    return new Promise((resolve) => {
      waiting.push(() =>
        resolve(
          new Response(JSON.stringify({ diffstat: { linesAdded: 3, linesDeleted: 1, linesChanged: 4 } }), {
            headers: { "content-type": "application/json" }
          })
        )
      )
    })
  }
  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  const answerAll = async () => {
    while (waiting.length > 0) {
      for (const answer of waiting.splice(0)) answer()
      await Bun.sleep(0)
    }
  }
  return { asked, answerAll, answered: () => waiting.length }
}

const rows = (count: number): ReadonlyArray<InvolvedPullRequest> =>
  Array.from(
    { length: count },
    (_, at) =>
      ({
        id: `PR_${at + 1}`,
        reference: { owner: "flazouh", repo: "stack-probe", number: at + 1 },
        headSha: `sha${at + 1}`
      }) as unknown as InvolvedPullRequest
  )

const aScreen = () => {
  const page = {} as Window
  const aside = settingAside(page)
  return { page, aside }
}

const sizing = (aside: ReturnType<typeof settingAside>, count: number) =>
  Effect.runPromise(sizesOf(rows(count)).pipe(aside.within, Effect.provide(layer)))

describe("a list's columns while the reader is elsewhere", () => {
  test("a press to another page stops the rows' sizes being read, and the read still answers", async () => {
    const network = holdOpen()
    const { page, aside } = aScreen()
    aside.holding((path) => path === LIST)

    const sized = sizing(aside, 20)
    await Bun.sleep(0)
    expect(network.asked).toHaveLength(8)

    pressingFor(page, "/flazouh/stack-probe/pull/3")
    await network.answerAll()

    expect(network.asked).toHaveLength(8)
    expect((await sized).size).toBe(0)
  })

  test("a press that stays on the list does not", async () => {
    const network = holdOpen()
    const { page, aside } = aScreen()
    aside.holding((path) => path === LIST)

    const sized = sizing(aside, 12)
    await Bun.sleep(0)
    pressingFor(page, LIST)
    await network.answerAll()

    expect(network.asked).toHaveLength(12)
    expect((await sized).size).toBe(12)
  })

  test("the screen leaving stops them too, and a screen stood up again reads afresh", async () => {
    const network = holdOpen()
    const { aside } = aScreen()
    const leave = aside.holding(() => true)
    leave()

    expect((await sizing(aside, 5)).size).toBe(0)
    expect(network.asked).toHaveLength(0)

    aside.holding(() => true)
    const sized = sizing(aside, 5)
    await Bun.sleep(0)
    await network.answerAll()

    expect((await sized).size).toBe(5)
  })

  test("a read made by nobody's screen is never set aside", async () => {
    const network = holdOpen()

    const sized = Effect.runPromise(sizesOf(rows(3)).pipe(Effect.provide(layer)))
    await Bun.sleep(0)
    await network.answerAll()

    expect((await sized).size).toBe(3)
  })
})
