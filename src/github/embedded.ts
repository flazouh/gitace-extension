/**
 * The payload GitHub embeds in a page it rendered.
 *
 * Their React pages ship their own data inside the document, in a script tag they
 * mark themselves. Most routes also answer that data as JSON, which is what the
 * rest of this gateway asks for — but the code view answers with the route alone
 * and never with the layout around it, and the layout is where
 * `currentUserCanPush` is. So a repository's front page is read out of a document,
 * and this is the reader.
 *
 * Written with `indexOf` and `slice` rather than a regular expression or a parser.
 * A document is a few hundred kilobytes, most of it a rendered README, and both of
 * the other approaches walk all of it: a parser builds a throwaway DOM, and a
 * regular expression with a lazy body backtracks across the same text. This looks
 * at the markers and parses one substring.
 */

import { Option } from "effect"

/** How their React roots mark the script holding their data. */
const OPENING = '<script type="application/json" data-target="react-app.embeddedData">'

const CLOSING = "</script>"

/**
 * The embedded payload naming a given route, out of a page's HTML.
 *
 * Asked for by route name because a document holds several of these. A repository
 * page carries its own `react-partial` payloads for the header and the sidebar as
 * well, and on some pages more than one `react-app` — so the first script found is
 * not reliably the right one, and taking it would decode the header's data as a
 * file tree.
 *
 * Checked with `indexOf` on the slice before anything is parsed, so that a
 * document holding four payloads costs one `JSON.parse` rather than four.
 */
/**
 * Every payload a page carries, in the order the document holds them.
 *
 * For a reader that knows the shape it wants rather than the name it is under. The two
 * code view pages read this way: whichever script decodes is the answer, so nobody has
 * to spell `codeViewBlobLayoutRoute.StyledBlob` and nothing breaks when GitHub renames
 * it. A repository page has one script holding three of their route payloads side by
 * side, and a file page one holding four.
 *
 * All of them parsed, rather than the first that mentions a name. That is one `JSON.parse`
 * per script on a page whose scripts are the page, and both pages measured have one.
 */
export const embeddedPayloads = (html: string): ReadonlyArray<unknown> => {
  const payloads: Array<unknown> = []
  let from = html.indexOf(OPENING)

  while (from !== -1) {
    const opens = from + OPENING.length
    const closes = html.indexOf(CLOSING, opens)
    if (closes === -1) return payloads

    const parsed = Option.liftThrowable(JSON.parse)(html.slice(opens, closes))
    if (Option.isSome(parsed)) payloads.push(parsed.value)

    from = html.indexOf(OPENING, closes)
  }

  return payloads
}

export const embeddedPayload = (html: string, naming: string): Option.Option<unknown> => {
  let from = html.indexOf(OPENING)

  while (from !== -1) {
    const opens = from + OPENING.length
    const closes = html.indexOf(CLOSING, opens)
    if (closes === -1) return Option.none()

    const held = html.slice(opens, closes)
    if (held.includes(naming)) {
      // Their own escaping, and the reason this is worth guarding: a README
      // containing the closing tag as text would end the script early, so GitHub
      // writes it escaped and the slice above can still be invalid JSON.
      const parsed = Option.liftThrowable(JSON.parse)(held)
      if (Option.isSome(parsed)) return parsed
    }

    from = html.indexOf(OPENING, closes)
  }

  return Option.none()
}

/** How their router writes the key of a query it rendered into the page. */
const QUERY = 'queryHash:"'

/** The first value of every key their code view gives one of its queries. */
const CODE_VIEW = "code-view"

/**
 * The end of a JavaScript string that starts at `from`: the first quote not escaped.
 *
 * A run of backslashes before a quote is counted rather than one looked at, because
 * `\\"` is an escaped backslash and then the end, where `\"` is a quote inside.
 */
const stringEnd = (html: string, from: number): number => {
  let at = html.indexOf('"', from)

  while (at !== -1) {
    let slashes = 0
    while (html[at - 1 - slashes] === "\\") slashes += 1
    if (slashes % 2 === 0) return at
    at = html.indexOf('"', at + 1)
  }

  return -1
}

/**
 * Every route their router read a page's code view from, in the order the page has them.
 *
 * Their code pages left the script tag above on 2026-10-15. The document is drawn by
 * their router now, and it carries its data as JavaScript rather than JSON: one object
 * per query, each keyed by a JSON array naming the route it was read from. Those routes
 * answer the same data as JSON, which is what a reader here can decode, so this names
 * them and the gateway asks.
 *
 * Every code view query, rather than the ones under a name. Their page splits one read
 * into several (the file's lines, the About panel, push rights) and which of them a
 * screen needs is the decoders' call, the same way `embeddedPayloads` leaves it to them.
 *
 * The key is a JSON string inside a JavaScript string, so it is unescaped once and then
 * parsed. A key either step refuses is passed over.
 */
export const queriedRoutes = (html: string): ReadonlyArray<string> => {
  const routes: Array<string> = []
  let from = html.indexOf(QUERY)

  while (from !== -1) {
    const opens = from + QUERY.length
    const closes = stringEnd(html, opens)
    if (closes === -1) return routes

    const key = Option.liftThrowable(JSON.parse)(`"${html.slice(opens, closes)}"`).pipe(
      Option.flatMap((text) => Option.liftThrowable(JSON.parse)(String(text)))
    )
    const route = Option.flatMap(key, routeOfQuery)
    if (Option.isSome(route) && !routes.includes(route.value)) routes.push(route.value)

    from = html.indexOf(QUERY, closes)
  }

  return routes
}

/**
 * The route a code view query key names: its last entry's `pathname`, with the
 * `searchParams` beside it that hold a value. Their front page writes
 * `include_sidebar_about: null` there, which their router leaves out of the address.
 */
const routeOfQuery = (key: unknown): Option.Option<string> => {
  if (!Array.isArray(key) || key[0] !== CODE_VIEW) return Option.none()

  const last: unknown = key[key.length - 1]
  if (typeof last !== "object" || last === null || !("pathname" in last)) return Option.none()
  if (typeof last.pathname !== "string" || !last.pathname.startsWith("/")) return Option.none()

  const search = new URLSearchParams()
  const params: unknown = "searchParams" in last ? last.searchParams : null
  if (typeof params === "object" && params !== null) {
    for (const [name, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) search.append(name, String(value))
    }
  }

  const query = search.toString()
  return Option.some(query === "" ? last.pathname : `${last.pathname}?${query}`)
}
