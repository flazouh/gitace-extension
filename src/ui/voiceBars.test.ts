import { describe, expect, test } from "bun:test"
import { bar, drifted, loudness, smoothed } from "./voiceBars"

describe("the bars of a voice", () => {
  test("taper to nothing at both ends of the row", () => {
    expect(bar(0, 1, 0)).toBe(0)
    expect(bar(1, 1, 0)).toBeLessThan(0.001)
    expect(bar(0.5, 1, 0)).toBeGreaterThan(0.3)
  })

  test("stand taller for a louder voice, and never vanish while it listens", () => {
    const quiet = bar(0.5, 0, 0)
    expect(quiet).toBeGreaterThan(0)
    expect(bar(0.5, 0.8, 0)).toBeGreaterThan(quiet)
  })

  test("rise to a word at once and fall from it slowly", () => {
    const frame = 1 / 60
    expect(smoothed(0, 1, frame)).toBeGreaterThan(0.5)
    expect(smoothed(1, 0, frame)).toBeGreaterThan(0.85)
  })

  test("drift faster the louder the voice", () => {
    expect(drifted(0, 1, 1)).toBeGreaterThan(drifted(0, 0, 1))
  })

  test("hear silence as nothing and a full-scale voice as all", () => {
    expect(loudness(new Float32Array(128))).toBe(0)
    expect(loudness(new Float32Array(128).fill(0.5))).toBe(1)
    expect(loudness(new Float32Array())).toBe(0)
  })
})
