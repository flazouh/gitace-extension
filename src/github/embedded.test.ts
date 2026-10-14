import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { embeddedPayload, queriedRoutes } from "./embedded"

const script = (said: string) =>
  `<script type="application/json" data-target="react-app.embeddedData">${said}</script>`

const found = (html: string, naming: string) => Option.getOrNull(embeddedPayload(html, naming))

describe("the payload GitHub embeds in a page it rendered", () => {
  test("reads it out of the script they mark", () => {
    expect(found(`<html>${script('{"payload":{"codeViewRepoRoute":{"a":1}}}')}</html>`, "codeViewRepoRoute")).toEqual({
      payload: { codeViewRepoRoute: { a: 1 } }
    })
  })

  /*
   * The case that makes the route name a parameter rather than taking the first
   * script found. A repository page carries payloads for its header and its
   * sidebar as well, and decoding the header's data as a file tree fails in a way
   * that reads as a broken repository.
   */
  test("passes over a payload for another part of the page", () => {
    const html = script('{"payload":{"repoHeader":{}}}') + script('{"payload":{"codeViewRepoRoute":{"a":2}}}')
    expect(found(html, "codeViewRepoRoute")).toEqual({ payload: { codeViewRepoRoute: { a: 2 } } })
  })

  test("says nothing where the page carries no such payload", () => {
    expect(found("<html><body>nothing here</body></html>", "codeViewRepoRoute")).toBeNull()
  })

  test("says nothing rather than throwing where their script holds broken JSON", () => {
    expect(found(script('{"codeViewRepoRoute": oops}'), "codeViewRepoRoute")).toBeNull()
  })

  test("keeps looking after a broken one, so a bad payload does not hide a good one", () => {
    const html = script('{"codeViewRepoRoute": oops}') + script('{"codeViewRepoRoute":{"a":3}}')
    expect(found(html, "codeViewRepoRoute")).toEqual({ codeViewRepoRoute: { a: 3 } })
  })

  test("says nothing where their script never closes", () => {
    expect(found(`<html>${'<script type="application/json" data-target="react-app.embeddedData">{'}`, "codeViewRepoRoute")).toBeNull()
  })
})

/*
 * What their router writes into a page since they moved the code view onto it, trimmed
 * from `GET /flazouh/ace` and `GET /flazouh/ace/blob/main/README.md` on 2026-10-15. The
 * query keys are JSON inside a JavaScript string, so every quote in them is escaped.
 */
const query = (key: ReadonlyArray<unknown>) =>
  `queryHash:${JSON.stringify(JSON.stringify(key))}},$R[1]={dehydratedAt:1792020583684,`

describe("the routes their router read a page from", () => {
  test("names every route a code view query was read from, in the order the page has them", () => {
    const html =
      query(["repo-layout-nav", "flazouh", "ace"]) +
      query(["code-view", "codeViewLayoutRoute", "/:owner/:repo", "mainQuery", { pathname: "/flazouh/ace/_layout" }]) +
      query([
        "code-view",
        "codeViewRepoRoute",
        "/:owner/:repo",
        "mainQuery",
        { pathname: "/flazouh/ace", searchParams: { include_sidebar_about: null } }
      ]) +
      query(["code-view", "codeViewRepoRoute", "/:owner/:repo", "sidebarAbout", { pathname: "/flazouh/ace/_sidebar/about" }])

    expect(queriedRoutes(html)).toEqual(["/flazouh/ace/_layout", "/flazouh/ace", "/flazouh/ace/_sidebar/about"])
  })

  test("names a route once where two queries read it", () => {
    const html =
      query(["code-view", "codeViewBlobRoute", "", "mainQuery", { pathname: "/o/r/blob/main/a.md" }]) +
      query(["code-view", "codeViewBlobRoute", "", "mainQuery", { pathname: "/o/r/blob/main/a.md" }])

    expect(queriedRoutes(html)).toEqual(["/o/r/blob/main/a.md"])
  })

  test("keeps the search parameters that hold a value, and leaves out the empty ones", () => {
    const html = query([
      "code-view",
      "codeViewBlobRoute",
      "",
      "mainQuery",
      { pathname: "/o/r/blob/main/a.md", searchParams: { plain: 1, include_sidebar_about: null } }
    ])

    expect(queriedRoutes(html)).toEqual(["/o/r/blob/main/a.md?plain=1"])
  })

  test("keeps a path whose own name holds an escaped quote", () => {
    const html = query(["code-view", "codeViewBlobRoute", "", "mainQuery", { pathname: '/o/r/blob/main/say "hi".md' }])

    expect(queriedRoutes(html)).toEqual(['/o/r/blob/main/say "hi".md'])
  })

  test("passes over a key it cannot read and keeps looking", () => {
    const html =
      'queryHash:"[\\"code-view\\", oops"}' +
      query(["code-view", "codeViewRepoRoute", "", "mainQuery", { pathname: "/o/r" }])

    expect(queriedRoutes(html)).toEqual(["/o/r"])
  })

  test("names nothing on a page their router did not draw", () => {
    expect(queriedRoutes("<html><body>nothing here</body></html>")).toEqual([])
  })
})
