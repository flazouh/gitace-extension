import { describe, expect, test } from "bun:test"
import { alsoOn, browserIn, STORES } from "./stores"

const AGENTS = {
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  edge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  firefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0",
  safari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
} as const

describe("the install button follows the reader's browser", () => {
  test("Chrome and every Chromium browser go to the Chrome Web Store", () => {
    expect(browserIn(AGENTS.chrome)).toBe("chrome")
    expect(browserIn(AGENTS.edge)).toBe("chrome")
  })

  test("Firefox goes to Mozilla's listing", () => {
    expect(browserIn(AGENTS.firefox)).toBe("firefox")
    expect(STORES.firefox.at).toStartWith("https://addons.mozilla.org/")
  })

  test("Safari goes to the latest release", () => {
    expect(browserIn(AGENTS.safari)).toBe("safari")
  })

  test("a browser it cannot name gets Chrome", () => {
    expect(browserIn("")).toBe("chrome")
  })

  test("the tag names the other two", () => {
    expect(alsoOn("chrome")).toBe("Also on Firefox and Safari")
    expect(alsoOn("firefox")).toBe("Also on Chrome and Safari")
  })
})
