import { describe, expect, it } from "bun:test"
import { THEME_KNOBS } from "./Settings"
import { packOf, resolveAppearance, tokensOf, type Pack } from "./theme"

/**
 * Every pack the knob offers, which is every choice on it but one.
 *
 * `match` is an answer and not a pack: it says the place decides. It has no
 * colours of its own to be distinct from anything, and `packOf` is what turns it
 * into one of these.
 */
const PACKS = THEME_KNOBS.find((one) => one.key === "pack")!
  .choices.map((choice) => choice.value)
  .filter((value): value is Pack => value !== "match")

describe("resolving appearance", () => {
  it("follows the OS when appearance is system", () => {
    expect(resolveAppearance("system", true)).toBe("dark")
    expect(resolveAppearance("system", false)).toBe("light")
  })

  it("forces light or dark when asked", () => {
    expect(resolveAppearance("light", true)).toBe("light")
    expect(resolveAppearance("dark", false)).toBe("dark")
  })
})

describe("the colour packs", () => {
  it("gives GitAce Extension dark Ace's warm dark canvas and ink", () => {
    expect(tokensOf("gitace", "dark")["--color-canvas"]).toBe("#141413")
    expect(tokensOf("gitace", "dark")["--color-surface"]).toBe("#1C1C1A")
    expect(tokensOf("gitace", "dark")["--color-ink"]).toBe("#F0EEE6")
  })

  it("gives GitAce Extension light Ace's warm light canvas and ink", () => {
    expect(tokensOf("gitace", "light")["--color-canvas"]).toBe("#F0EEE6")
    expect(tokensOf("gitace", "light")["--color-surface"]).toBe("#EAE7DC")
    expect(tokensOf("gitace", "light")["--color-ink"]).toBe("#141413")
  })

  it("matches Cursor Dark Anysphere and Cursor Light", () => {
    // From Cursor.app extensions/theme-cursor/themes/*.json
    expect(tokensOf("cursor", "dark")["--color-canvas"]).toBe("#181818")
    expect(tokensOf("cursor", "dark")["--color-accent-emphasis"]).toBe("#81A1C1")
    expect(tokensOf("cursor", "light")["--color-canvas"]).toBe("#FCFCFC")
    expect(tokensOf("cursor", "light")["--color-ink-accent"]).toBe("#0064B0")
  })

  it("makes every pack distinct on canvas in dark", () => {
    const canvases = PACKS.map((pack) => tokensOf(pack, "dark")["--color-canvas"])
    expect(new Set(canvases).size).toBe(PACKS.length)
  })

  it("paints every shipped pack in both schemes", () => {
    for (const pack of PACKS) {
      expect(tokensOf(pack, "light")["--color-canvas"].length).toBeGreaterThan(0)
      expect(tokensOf(pack, "dark")["--color-canvas"].length).toBeGreaterThan(0)
    }
  })

  it("answers every token name the screens spend", () => {
    const tokens = tokensOf("gitace", "dark")
    for (const name of [
      "--color-canvas",
      "--color-inset",
      "--color-surface",
      "--color-raised",
      "--color-ink",
      "--color-ink-muted",
      "--color-ink-accent",
      "--color-ink-on-emphasis",
      "--color-pass",
      "--color-fail",
      "--color-busy",
      "--color-done",
      "--color-line",
      "--color-hover",
      "--color-active"
    ] as const) {
      expect(tokens[name].length).toBeGreaterThan(0)
    }
  })
})

describe("the pack a place wears when nobody asked for one", () => {
  it("is the place's own, which is what match means", () => {
    expect(packOf("match", "github")).toBe("github")
    expect(packOf("match", "gitace")).toBe("gitace")
  })

  it("is the reader's, wherever they are, once they name one", () => {
    expect(packOf("dracula", "github")).toBe("dracula")
    expect(packOf("gitace", "github")).toBe("gitace")
  })

  it("never answers with something the table cannot paint", () => {
    for (const pack of PACKS) {
      expect(tokensOf(packOf(pack, "github"), "light")["--color-canvas"].length).toBeGreaterThan(0)
    }
    expect(tokensOf(packOf("match", "github"), "dark")["--color-canvas"].length).toBeGreaterThan(0)
  })
})
