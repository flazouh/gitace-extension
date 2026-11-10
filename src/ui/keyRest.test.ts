import { afterEach, describe, expect, test } from "bun:test"
import { whenTheKeyRests } from "./keyRest"

/*
 * The row the keyboard stands on is the reader's attention as plainly as a pointer on
 * it, and Enter is the press. A reader walking a list with the arrows had nothing read
 * ahead, so every Enter waited on GitHub for the whole page.
 */

const list = (count: number): HTMLElement => {
  const root = document.createElement("div")
  for (let at = 0; at < count; at += 1) {
    const row = document.createElement("div")
    row.setAttribute("data-row", "")
    const link = document.createElement("a")
    link.href = `https://github.com/oven-sh/bun/pull/${at + 1}`
    row.append(link)
    root.append(row)
  }
  document.body.append(root)
  return root
}

const choose = (root: HTMLElement, at: number): void => {
  for (const [index, row] of [...root.children].entries()) {
    if (index === at) row.setAttribute("data-chosen", "")
    else row.removeAttribute("data-chosen")
  }
}

const wait = (millis: number) => new Promise((rest) => setTimeout(rest, millis))

const stops: Array<() => void> = []
afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  document.body.replaceChildren()
})

describe("the row the keyboard rests on", () => {
  test("is read once the keyboard has stood on it for the page's dwell", async () => {
    const root = list(3)
    const rested: Array<string> = []
    stops.push(whenTheKeyRests(root, () => 20, (link) => rested.push(link.href)))

    choose(root, 1)
    await wait(5)
    expect(rested).toEqual([])
    await wait(40)

    expect(rested).toEqual(["https://github.com/oven-sh/bun/pull/2"])
  })

  test("is not every row a held arrow passes over, only the one it stops on", async () => {
    const root = list(4)
    const rested: Array<string> = []
    stops.push(whenTheKeyRests(root, () => 30, (link) => rested.push(link.href)))

    for (const at of [0, 1, 2]) {
      choose(root, at)
      await wait(5)
    }
    await wait(60)

    expect(rested).toEqual(["https://github.com/oven-sh/bun/pull/3"])
  })

  test("is left alone where there is nothing of ours to read behind it", async () => {
    const root = list(2)
    const rested: Array<string> = []
    stops.push(whenTheKeyRests(root, () => null, (link) => rested.push(link.href)))

    choose(root, 0)
    await wait(40)

    expect(rested).toEqual([])
  })

  test("reads nothing once the list has stopped listening", async () => {
    const root = list(2)
    const rested: Array<string> = []
    const stop = whenTheKeyRests(root, () => 20, (link) => rested.push(link.href))

    choose(root, 0)
    stop()
    await wait(40)

    expect(rested).toEqual([])
  })
})
