import { describe, expect, it } from "bun:test"
import { Effect, Option } from "effect"
import type { ListedKeyValue } from "../ports/KeyValue"
import { readSettings } from "../domain/Settings"
import { SETTINGS } from "../ui/keeping"
import { settingsStore } from "./store"
import { carryArea, carryFor, carryShelf, dropOldLedger, renamed, type Shelf } from "./renaming"

/** What a reader had before the rename: their settings, and a filter left in a box. */
const before = (): Record<string, unknown> => ({
  "gitquiet.settings": {
    theme: { appearance: "dark", pack: "gitquiet", art: "gitquiet" },
    diff: { layout: "split" }
  },
  "gitquiet:filter:working-set": "review",
  gistLabels: "kept as it was",
  "route:/flazouh/gitace-extension/pulls": { at: 1 }
})

/** An extension storage area that holds its entries in the open and counts its writes. */
const area = (held: Record<string, unknown>) => {
  const calls = { set: 0, remove: 0 }
  const fake: ListedKeyValue & { held: Record<string, unknown>; calls: typeof calls; failSet: boolean } = {
    held,
    calls,
    failSet: false,
    getAll: () => Promise.resolve({ ...fake.held }),
    get: (keys) =>
      Promise.resolve(
        Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, fake.held[key]]))
      ),
    set: (items) => {
      calls.set += 1
      if (fake.failSet) return Promise.reject(new Error("over quota"))
      Object.assign(fake.held, items)
      return Promise.resolve()
    },
    remove: (keys) => {
      calls.remove += 1
      for (const key of keys) delete fake.held[key]
      return Promise.resolve()
    }
  }
  return fake
}

/** The page's own storage, with the same counting. */
const shelf = (entries: Record<string, string>) => {
  const held = new Map(Object.entries(entries))
  const writes: Array<string> = []
  const fake: Shelf & { held: Map<string, string>; writes: Array<string> } = {
    held,
    writes,
    get length() {
      return held.size
    },
    key: (at) => [...held.keys()][at] ?? null,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(`set ${key}`)
      held.set(key, value)
    },
    removeItem: (key) => {
      writes.push(`remove ${key}`)
      held.delete(key)
    }
  }
  return fake
}

describe("the name an old key moves to", () => {
  it("swaps the stem and keeps the rest, in both spellings the keys used", () => {
    expect(renamed("gitquiet.settings")).toEqual(Option.some("gitace.settings"))
    expect(renamed("gitquiet:filter:o/r")).toEqual(Option.some("gitace:filter:o/r"))
  })

  it("leaves every other key alone, GitHub's and the cache's included", () => {
    expect(renamed("gitace.settings")).toEqual(Option.none())
    expect(renamed("gistLabels")).toEqual(Option.none())
    expect(renamed("route:/flazouh/gitquiet/pulls")).toEqual(Option.none())
    expect(renamed("gitquietness")).toEqual(Option.none())
  })
})

describe("the carry for one place", () => {
  it("writes each old entry under its new name and drops the old name", () => {
    const { moves, gone } = carryFor({ "gitquiet.scheme": "dark", other: 1 })

    expect(moves).toEqual({ "gitace.scheme": "dark" })
    expect(gone).toEqual(["gitquiet.scheme"])
  })

  it("lets an entry already under the new name win, because this version wrote it", () => {
    const { moves, gone } = carryFor({ "gitquiet.scheme": "dark", "gitace.scheme": "light" })

    expect(moves).toEqual({})
    expect(gone).toEqual(["gitquiet.scheme"])
  })
})

describe("carrying the extension's own storage", () => {
  it("keeps a reader's old settings, which the store then reads back as they chose them", async () => {
    const synced = area(before())

    expect(await Effect.runPromise(carryArea(synced))).toBe(2)

    expect(synced.held["gitquiet.settings"]).toBeUndefined()
    expect(synced.held["gitace:filter:working-set"]).toBe("review")
    expect(synced.held["gistLabels"]).toBe("kept as it was")

    const read = await Effect.runPromise(
      settingsStore({ ...synced, onChanged: { addListener: () => {}, removeListener: () => {} } }).read
    )
    expect(read.diff.layout).toBe("split")
    expect(read.theme.appearance).toBe("dark")
    // The product's own pack and icons were stored under the old word too.
    expect(read.theme.pack).toBe("gitace")
    expect(read.theme.art).toBe("gitace")
    expect(SETTINGS).toBe("gitace.settings")
  })

  it("does nothing the second time", async () => {
    const synced = area(before())
    await Effect.runPromise(carryArea(synced))
    const after = { ...synced.held }
    const calls = { ...synced.calls }

    expect(await Effect.runPromise(carryArea(synced))).toBe(0)

    expect(synced.held).toEqual(after)
    expect(synced.calls).toEqual(calls)
  })

  it("keeps the old entry when the new one could not be written, for the next start to try", async () => {
    const synced = area(before())
    synced.failSet = true

    const outcome = await Effect.runPromise(Effect.result(carryArea(synced)))

    expect(outcome._tag).toBe("Failure")
    expect(synced.calls.remove).toBe(0)
    expect(synced.held["gitquiet.settings"]).toBeDefined()
  })
})

describe("carrying the page's own storage", () => {
  const page = () =>
    shelf({
      "gitquiet.scheme": "dark",
      "gitquiet.pack": "gitquiet",
      "gitquiet:filter:working-set": "review",
      "gitquiet.held.issue:1": "a draft",
      "gitace.lately": "[\"o/r\"]",
      "gitquiet.lately": "[\"older\"]",
      "logged-in": "true"
    })

  it("moves every old entry, keeps a newer one, and leaves GitHub's own keys alone", () => {
    const local = page()

    expect(Effect.runSync(carryShelf(local))).toBe(5)

    expect(Object.fromEntries(local.held)).toEqual({
      "gitace.scheme": "dark",
      "gitace.pack": "gitquiet",
      "gitace:filter:working-set": "review",
      "gitace.held.issue:1": "a draft",
      "gitace.lately": "[\"o/r\"]",
      "logged-in": "true"
    })
  })

  it("writes every new entry before it removes any old one", () => {
    const local = page()
    Effect.runSync(carryShelf(local))

    const firstRemove = local.writes.findIndex((one) => one.startsWith("remove"))
    const lastSet = local.writes.findLastIndex((one) => one.startsWith("set"))
    expect(lastSet).toBeLessThan(firstRemove)
  })

  it("does nothing the second time", () => {
    const local = page()
    Effect.runSync(carryShelf(local))
    const after = new Map(local.held)
    local.writes.length = 0

    expect(Effect.runSync(carryShelf(local))).toBe(0)

    expect(local.held).toEqual(after)
    expect(local.writes).toEqual([])
  })

  it("leaves the old entries where they were when a write is refused", () => {
    const local = page()
    local.setItem = () => {
      throw new Error("QuotaExceededError")
    }

    const outcome = Effect.runSync(Effect.result(carryShelf(local)))

    expect(outcome._tag).toBe("Failure")
    expect(local.held.get("gitquiet.scheme")).toBe("dark")
  })
})

describe("the stored word for the product's own look", () => {
  it("reads the old word as the new one", () => {
    const read = readSettings({ theme: { pack: "gitquiet", art: "gitquiet" } })

    expect(read.theme.pack).toBe("gitace")
    expect(read.theme.art).toBe("gitace")
  })
})

describe("the old ledger cache", () => {
  it("is dropped by its old name", async () => {
    const asked: Array<string> = []
    const factory = {
      deleteDatabase: (name: string) => {
        asked.push(name)
        const request = { onsuccess: null, onerror: null, onblocked: null } as unknown as IDBOpenDBRequest
        queueMicrotask(() => request.onsuccess?.(new Event("success")))
        return request
      }
    }

    await Effect.runPromise(dropOldLedger(factory))

    expect(asked).toEqual(["gitquiet-ledger"])
  })
})
