import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

const desk = () => readFileSync("src/ui/desk.css", "utf8")

const rule = (selector: string): string => {
  const at = desk().indexOf(`${selector} {`)
  return desk().slice(at, desk().indexOf("}", at))
}

describe("an 800-pixel window, which scrolled sideways", () => {
  test("gives way to one control's width, so an 800-pixel window does not scroll sideways", () => {
    const field = rule(":is(#gitace-root, [data-gitace-outside]) .d-search.d-palette")

    expect(field).toContain("min-width: var(--d-control);")
    expect(field).toContain("container: palette / inline-size;")
  })

  test("drops its label and its keys once it is that narrow", () => {
    const narrow = desk().slice(desk().indexOf("@container palette ("))

    expect(narrow.slice(0, narrow.indexOf("}"))).toContain(".d-palette-said, .d-palette .d-kbd")
  })

  test("wraps the filters bar's chips rather than running them off the card", () => {
    const chips = rule(":is(#gitace-root, [data-gitace-outside]) .d-projects")

    expect(chips).toContain("flex-wrap: wrap;")
    expect(chips).toContain("min-width: 0;")
  })

  test("keeps a row inside a main card narrowed by the sidebar", () => {
    const narrow = desk().slice(desk().indexOf("@container (max-width: 640px)"))
    const step = narrow.slice(0, narrow.indexOf("}\n}") + 3)

    for (const track of ["--d-t-title", "--d-t-number", "--d-t-checks", "--d-t-age"])
      expect(step).toContain(`${track}: 0px;`)
    expect(step).toContain(".d-col-number, .d-col-checks, .d-col-age")
  })

  test("wraps the filters bar's chips rather than running them off the card", () => {
    const chips = rule(":is(#gitace-root, [data-gitace-outside]) .d-projects")

    expect(chips).toContain("flex-wrap: wrap;")
    expect(chips).toContain("min-width: 0;")
  })

  test("keeps a row inside a main card narrowed by the sidebar", () => {
    const narrow = desk().slice(desk().indexOf("@container (max-width: 640px)"))
    const step = narrow.slice(0, narrow.indexOf("}\n}") + 3)

    for (const track of ["--d-t-title", "--d-t-number", "--d-t-checks", "--d-t-age"])
      expect(step).toContain(`${track}: 0px;`)
    expect(step).toContain(".d-col-number, .d-col-checks, .d-col-age")
  })
})
