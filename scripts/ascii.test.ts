import { describe, expect, test } from "bun:test"
import { asciiOnly } from "./ascii"

describe("writing a bundle a content script can be", () => {
  test("leaves plain text alone", () => {
    expect(asciiOnly('const a = "b";')).toBe('const a = "b";')
  })

  test("escapes what is past ASCII, and the escape means the same", () => {
    const code = 'globalThis.said = "naïve — ✓ 😀";'
    const written = asciiOnly(code)

    expect(/^[\x00-\x7f]*$/.test(written)).toBe(true)
    const run = new Function(`${written} return globalThis.said`) as () => string
    expect(run()).toBe("naïve — ✓ 😀")
  })

  test("keeps a lone surrogate, which UTF-8 cannot carry", () => {
    const written = asciiOnly("const lone = /[\ud800-\udbff]/;")

    expect(written).toBe("const lone = /[\\ud800-\\udbff]/;")
  })
})
