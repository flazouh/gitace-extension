/**
 * Call signatures set apart, where the grammar runs them together.
 *
 * In code written without semicolons, an interface's generic call signatures sit
 * on lines of their own:
 *
 *     <P extends string>(path: P): Box<P>
 *     <Q extends string>(path: Q): Box<Q>
 *
 * TypeScript knows a new member starts at the `<`. The tree-sitter grammar reads
 * `Box<P>` and the `<Q …>` under it as one type with arguments, fails, and its
 * recovery can take the rest of the file with it — `honojs/hono`'s `src/types.ts`
 * came back as a single error, and no name in it had a Writing.
 *
 * So a `;` goes where TypeScript would have put one: in the last column of the
 * indentation before a line that opens with a generic's `<`, where the line above
 * ended a member rather than leaving something open. A character for a character,
 * so every row and column the grammar reports is the file's own, and the file as
 * written is still what Writings are cut from.
 */
export const signaturesApart = (text: string): string => {
  const lines = text.split("\n")
  let above = ""
  for (const [at, line] of lines.entries()) {
    const opening = OPENS.exec(line)
    if (opening !== null && above !== "" && !LEFT_OPEN.test(above)) {
      const indent = opening[1] ?? ""
      lines[at] = `${indent.slice(0, -1)};${line.slice(indent.length)}`
    }
    const code = line.replace(/\/\/.*$/, "").trimEnd()
    if (code.trim() !== "") above = code
  }
  return lines.join("\n")
}

/** An indented line opening with `<` and a type parameter, or with `<` alone. */
const OPENS = /^(\s+)<(?:[A-Za-z_$]|\s*$)/

/** A line ending where the next one has to carry on: a list, a call, an operator. */
const LEFT_OPEN = /[;{,([|&=<:?]$/
