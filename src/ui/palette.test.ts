import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

const desk = () => readFileSync("src/ui/desk.css", "utf8")

const rule = (selector: string): string => {
  const at = desk().indexOf(`${selector} {`)
  return desk().slice(at, desk().indexOf("}", at))
}

describe("the palette's field in the bar", () => {
  test("gives way to one control's width, so an 800-pixel window does not scroll sideways", () => {
    const field = rule(":is(#gitace-root, [data-gitace-outside]) .d-search.d-palette")

    expect(field).toContain("min-width: var(--d-control);")
    expect(field).toContain("container: palette / inline-size;")
  })

  test("drops its label and its keys once it is that narrow", () => {
    const narrow = desk().slice(desk().indexOf("@container palette ("))

    expect(narrow.slice(0, narrow.indexOf("}"))).toContain(".d-palette-said, .d-palette .d-kbd")
  })
})
