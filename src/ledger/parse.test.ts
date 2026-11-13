import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { TYPESCRIPT } from "./dialects/typescript"
import { parsed, reader, ready, type Shelf } from "./parse"
import type { Syntax } from "./syntax"
import { writingAt } from "./writings"

const SHELF: Shelf = {
  runtime: "node_modules/web-tree-sitter/web-tree-sitter.wasm",
  grammar: (file) => `node_modules/@vscode/tree-sitter-wasm/wasm/${file}`
}

/**
 * Generic call signatures on lines of their own, with no semicolon between them.
 *
 * The grammar reads the `Box<P>` ending one and the `<Q …>` opening the next as one
 * type with arguments, fails, and takes what follows the interface down with it:
 * here the next declaration is read as an expression and `Wanted` has no Writing.
 * In `honojs/hono`'s `src/types.ts`, 2,782 lines written this way, the error covered
 * the whole file and holding Command over any name in it underlined nothing.
 */
const OVERLOADED = [
  "export type Box<T> = T",
  "export interface Handler {",
  "  <P extends string>(path: P): Box<P>",
  "  <Q extends string>(path: Q): Box<Q>",
  "  <R extends string>(path: R): Box<R>",
  "}",
  "export type Wanted = Box<string>"
].join("\n")

const WANTED = { row: 6, column: "export type ".length }

const writingOf = (root: Syntax, text: string) => {
  const found = writingAt(root, text, WANTED, TYPESCRIPT)
  return found === null || found.at !== "here" ? null : found.writing
}

describe("a file whose call signatures the grammar runs together", () => {
  test("still has its names written down, for one file", async () => {
    const found = await Effect.runPromise(
      parsed(SHELF, "src/handler.ts", OVERLOADED, (root) => writingOf(root, OVERLOADED))
    )

    expect(found?.name).toBe("Wanted")
    expect(found?.line).toBe(7)
    // Cut from the file as written, not from the text the grammar was handed.
    expect(found?.signature).toBe("export type Wanted = Box<string>")
  })

  test("and for a repository read a file at a time", async () => {
    await Effect.runPromise(ready(SHELF))
    const read = await Effect.runPromise(reader(SHELF, (root, text) => writingOf(root, text)))

    expect(read("src/handler.ts", OVERLOADED)?.line).toBe(7)
  })

  test("leaves JSX, where a `<` opening a line is an element, as it was", async () => {
    const page = ["export const Page = () => (", "  <div>", "    <span>one</span>", "  </div>", ")"].join("\n")
    const clean = await Effect.runPromise(
      parsed(SHELF, "src/Page.tsx", page, (root) => (root as unknown as { hasError: boolean }).hasError)
    )

    expect(clean).toBe(false)
  })
})
