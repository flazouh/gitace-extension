import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { blobSha } from "./blob"
import { dialectFor } from "./dialects"
import { grownAt, MOST_FETCHED, type Fetching } from "./fromTree"
import type { Manifest, Store } from "./store"
import type { Told } from "./writings"

/**
 * A new commit of a repository read before: from its tree and the files nobody had read,
 * and from its archive where that cannot be done.
 */

const REPO = { owner: "octo-org", repo: "octo-repo" }
const SHA = "b".repeat(40)
const TREE = `https://api.github.com/repos/octo-org/octo-repo/git/trees/${SHA}?recursive=1`
const raw = (path: string): string => `https://raw.githubusercontent.com/octo-org/octo-repo/${SHA}/${path}`

/** What a file says, as the test's reader sees it: the text, as one declared name. */
const saying = (text: string): Told => ({ writings: [], mentions: [], declares: [text], borrows: [] })

const memory = (manifests: ReadonlyArray<Manifest>, told: ReadonlyMap<string, Told>): Store => ({
  manifest: (at) => Effect.succeed(manifests.find((one) => one.at === at) ?? null),
  keepManifest: () => Effect.void,
  latest: (repo) => Effect.succeed(manifests.find((one) => one.at.startsWith(`${repo}@`)) ?? null),
  told: (shas) =>
    Effect.succeed(new Map(shas.flatMap((sha) => {
      const one = told.get(sha)
      return one === undefined ? [] : [[sha, one] as const]
    }))),
  keepTold: () => Effect.void,
  forgetBeyond: () => Effect.succeed(0)
})

type Served = { readonly status?: number; readonly body: string }

/** A network that answers from a table and remembers what it was asked. */
const network = (served: ReadonlyMap<string, Served>) => {
  const asked: Array<string> = []
  const fetching: Fetching = (url) => {
    asked.push(url)
    const one = served.get(url)
    return Promise.resolve(new Response(one?.body ?? "", { status: one === undefined ? 404 : (one.status ?? 200) }))
  }
  return { asked, fetching }
}

/** Files nothing reads, so that a few new ones are a small share of the repository. */
const PICTURES = Array.from({ length: 100 }, (_, at) => [`media/${at}.png`, `${at}`.padStart(40, "f")] as const)

const treeOf = (files: ReadonlyArray<readonly [string, string]>, truncated = false, quiet = PICTURES): string =>
  JSON.stringify({
    sha: SHA,
    truncated,
    tree: [
      { path: "src", mode: "040000", type: "tree", sha: "d".repeat(40) },
      ...[...files, ...quiet].map(([path, sha]) => ({ path, mode: "100644", type: "blob", sha, size: 10 }))
    ]
  })

/** Two paths of the same contents, and only the second has a grammar. */
const ARCHIVE = new Map([["src/whole.html", "whole"], ["src/whole.ts", "whole"]])

/** Reads the commit, with an archive that says whether it was opened. */
const reading = (store: Store, fetching: Fetching) => {
  let opened = 0
  const archive = Effect.sync(() => {
    opened += 1
    return ARCHIVE as ReadonlyMap<string, string>
  })
  return Effect.runPromise(
    grownAt({ fetching, store, outline: (path, text) => (dialectFor(path) === null ? null : saying(text)), archive }, REPO, SHA)
  ).then((found) => ({ ...found, opened }))
}

const shaOf = (text: string): Promise<string> => Effect.runPromise(blobSha(text))

describe("a new commit of a repository read before", () => {
  test("fetches its tree and only the files the store has no saying for", async () => {
    const changed = await shaOf("changed")
    const config = await shaOf(`{"name":"@octo-org/x","main":"./index.ts"}`)
    const base: Manifest = {
      at: `octo-org/octo-repo@${"a".repeat(40)}`,
      files: [["src/kept.ts", "k".repeat(40)]],
      seen: 1,
      configs: [["package.json", "p".repeat(40), `{"name":"@octo-org/root"}`]]
    }
    const store = memory([base], new Map([["k".repeat(40), saying("kept")]]))
    const { asked, fetching } = network(
      new Map([
        [TREE, { body: treeOf([
          ["src/kept.ts", "k".repeat(40)],
          ["src/changed.ts", changed],
          ["readme.md", "r".repeat(40)],
          ["docs/kept.txt", "k".repeat(40)],
          ["package.json", "p".repeat(40)],
          ["packages/x/package.json", config]
        ]) }],
        [raw("src/changed.ts"), { body: "changed" }],
        [raw("packages/x/package.json"), { body: `{"name":"@octo-org/x","main":"./index.ts"}` }]
      ])
    )

    const { grown, whole, opened } = await reading(store, fetching)

    expect(opened).toBe(0)
    expect(whole).toBeNull()
    expect(asked).toEqual([TREE, raw("src/changed.ts"), raw("packages/x/package.json")])
    expect(grown.held).toEqual([
      { path: "src/kept.ts", sha: "k".repeat(40) },
      { path: "src/changed.ts", sha: changed },
      { path: "docs/kept.txt", sha: "k".repeat(40) }
    ])
    expect([...grown.fresh.keys()]).toEqual([changed])
    expect(grown.known.get("k".repeat(40))).toEqual(saying("kept"))
    expect(grown.configs.map((one) => [one.path, one.text])).toEqual([
      ["package.json", `{"name":"@octo-org/root"}`],
      ["packages/x/package.json", `{"name":"@octo-org/x","main":"./index.ts"}`]
    ])
    expect(grown.entries).toBe(6 + PICTURES.length)
  })

  test("keeps a fetched file under the sha of the text it parsed", async () => {
    // A byte order mark is in git's sha and not in the text a fetch decodes.
    const base: Manifest = { at: `octo-org/octo-repo@${"a".repeat(40)}`, files: [], seen: 1 }
    const { fetching } = network(
      new Map([
        [TREE, { body: treeOf([["src/marked.ts", "m".repeat(40)]]) }],
        [raw("src/marked.ts"), { body: "marked" }]
      ])
    )

    const { grown } = await reading(memory([base], new Map()), fetching)

    expect(grown.held).toEqual([{ path: "src/marked.ts", sha: await shaOf("marked") }])
  })
})

describe("the archive, where the tree cannot answer", () => {
  const base: Manifest = { at: `octo-org/octo-repo@${"a".repeat(40)}`, files: [], seen: 1 }

  test("is the first read of a repository, and the tree is not asked for", async () => {
    const { asked, fetching } = network(new Map())

    const { whole, opened } = await reading(memory([], new Map()), fetching)

    expect(asked).toEqual([])
    expect(opened).toBe(1)
    expect(whole).toBe(ARCHIVE)
  })

  test("is a private repository, whose tree answers 404", async () => {
    const { asked, fetching } = network(new Map())

    const { grown, opened } = await reading(memory([base], new Map()), fetching)

    expect(asked).toEqual([TREE])
    expect(opened).toBe(1)
    expect(grown.held.map((one) => one.path)).toEqual(["src/whole.html", "src/whole.ts"])
  })

  test("is a tree too large to be listed whole", async () => {
    const { fetching } = network(new Map([[TREE, { body: treeOf([["src/a.ts", "a".repeat(40)]], true) }]]))

    const { opened } = await reading(memory([base], new Map()), fetching)

    expect(opened).toBe(1)
  })

  test("is a file that could not be fetched", async () => {
    const { asked, fetching } = network(
      new Map([
        [TREE, { body: treeOf([["src/a.ts", "a".repeat(40)], ["src/b.ts", "b".repeat(40)]]) }],
        [raw("src/a.ts"), { body: "a" }],
        [raw("src/b.ts"), { status: 500, body: "" }]
      ])
    )

    const { opened } = await reading(memory([base], new Map()), fetching)

    expect(asked).toContain(raw("src/b.ts"))
    expect(opened).toBe(1)
  })

  test("is a small repository, whose archive is sooner than a request for each new file", async () => {
    const files = [["src/a.ts", "a".repeat(40)], ["src/b.ts", "b".repeat(40)]] as const
    const { asked, fetching } = network(new Map([[TREE, { body: treeOf(files, false, []) }]]))

    const { opened } = await reading(memory([base], new Map()), fetching)

    expect(asked).toEqual([TREE])
    expect(opened).toBe(1)
  })

  test("is more new files than are worth a request each, and none of them is fetched", async () => {
    const files = Array.from({ length: MOST_FETCHED + 1 }, (_, at) => [`src/f${at}.ts`, `${at}`.padStart(40, "0")] as const)
    const { asked, fetching } = network(new Map([[TREE, { body: treeOf(files) }]]))

    const { opened } = await reading(memory([base], new Map()), fetching)

    expect(asked).toEqual([TREE])
    expect(opened).toBe(1)
  })
})
