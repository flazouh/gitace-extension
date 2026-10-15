import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { GRAIN, NIGHT, TEXT_FIELDS } from "./fields"
import { EDGE, grained, over, ratio, TEXT } from "./contrast"

/**
 * Every text and control colour on the site against what is actually behind it.
 *
 * The page colours are read out of `ace.css` itself, so a token edited there is a token
 * checked here. The dark fields are checked at the lightest they reach under their text
 * (`fields.ts`), with the grain laid over that at its worst.
 */

const sheet = readFileSync(fileURLToPath(new URL("./ace.css", import.meta.url)), "utf8")

const token = (name: string): string => {
  const held = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6,8});`).exec(sheet)
  if (held?.[1] === undefined) throw new Error(`--${name} is missing from ace.css`)
  return held[1]
}

const paper = token("paper")
const paper2 = token("paper-2")
const ink = token("ink")
const ink2 = token("ink-2")
const ink3 = token("ink-3")
const edge = token("edge")
const cream = token("cream")
const chip = token("chip")
const hush = token("hush")
const violet = token("violet")
const violetInk = token("violet-ink")
const lilac = token("lilac")
const white = token("white")

const hero = grained(TEXT_FIELDS.hero, GRAIN)
const band = grained(TEXT_FIELDS.band, GRAIN)

/** The paper nav over the bottom of the hero's window, the darkest it gets. */
const navOverWindow = over("#ecebe7d1", NIGHT)

type Pair = readonly [what: string, fore: string, back: string, least: number]

export const PAIRS: ReadonlyArray<Pair> = [
  ["ink text on paper", ink, paper, TEXT],
  ["ink text on the paper nav over the window", ink, navOverWindow, TEXT],
  ["second ink on paper (paragraphs, footer links)", ink2, paper, TEXT],
  ["second ink on the second paper (the card you are on)", ink2, paper2, TEXT],
  ["third ink on paper (small print)", ink3, paper, TEXT],
  ["third ink on the second paper (card meta)", ink3, paper2, TEXT],
  ["violet text on paper (nav Install, useace.dev link)", violetInk, paper, TEXT],
  ["violet text on the second paper (hovered card)", violetInk, paper2, TEXT],
  ["violet nav Install over the window", violetInk, navOverWindow, TEXT],
  ["paper on the ink button", paper, ink, TEXT],
  ["paper on the ink button, hovered", paper, violetInk, TEXT],
  ["white on violet (bar, legend, spec row)", white, violet, TEXT],
  ["card border on paper", edge, paper, EDGE],
  ["focus ring on paper", violet, paper, EDGE],
  ["focus ring on the second paper", violet, paper2, EDGE],
  ["cream headline and nav on the hero", cream, hero, TEXT],
  ["chips on the hero", chip, hero, TEXT],
  ["the small label under 20, on the hero", hush, hero, TEXT],
  ["lilac tag and nav Install on the hero", lilac, hero, TEXT],
  ["lilac tag border and focus ring on the hero", lilac, hero, EDGE],
  ["cream button against the hero", cream, hero, EDGE],
  ["night text on the cream button", NIGHT, cream, TEXT],
  ["cream headline on the band", cream, band, TEXT],
  ["cream button against the band", cream, band, EDGE],
  ["lilac focus ring on the band", lilac, band, EDGE],
  ["the small inbox's text on its plate", "#f0eee6", "#141413", TEXT],
  ["the small inbox's count on its plate", "#a8a49b", "#141413", TEXT]
]

describe("every colour pair passes WCAG AA", () => {
  test.each(PAIRS.map((pair) => [...pair]))("%s", (_what, fore, back, least) => {
    expect(ratio(fore, back)).toBeGreaterThanOrEqual(least)
  })
})

describe("the ratio itself", () => {
  test("black on white is 21, and a colour on itself is 1", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5)
    expect(ratio("#777777", "#777777")).toBe(1)
  })

  test("grain only ever lightens a dark field", () => {
    expect(ratio(grained(NIGHT, GRAIN), "#000000")).toBeGreaterThan(ratio(NIGHT, "#000000"))
  })
})
