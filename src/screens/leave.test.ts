import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

const sourcesIn = (folder: string, keep: (name: string) => boolean) =>
  readdirSync(folder)
    .filter((name) => keep(name) && !name.includes(".test."))
    .map((name) => ({ name, text: readFileSync(`${folder}/${name}`, "utf8") }))

const screens = () => sourcesIn("src/screens", (name) => name.endsWith(".tsx"))
const drawn = () => sourcesIn("src/ui", (name) => name.endsWith("Screen.tsx"))

/**
 * Leave, on every page this extension draws.
 *
 * Twenty screens each wire it, which is how sixteen of them came to wire half of it: the
 * shell's own `stepAside` handed straight to the interface lets GitHub's page through and
 * stops there. Nothing was written down, so a reload drew ours again, and nothing was put
 * up, so the page had no way back to ours.
 */
describe("Leave GitAce Extension", () => {
  test("is the screen's own choosing of GitHub, never the shell's bare step aside", () => {
    for (const { name, text } of screens()) {
      if (!text.includes("handOverToGitHub(")) continue

      // Where the screen hands Leave over as `onUseGitHub`, its own step aside is what a failed
      // read offers for this page alone, and is meant to be the shell's.
      if (!text.includes("onUseGitHub={")) expect(text, name).not.toContain("onStepAside={standing.stepAside}")
      expect(text, name).toMatch(/function useGitHub\(\): void \{[\s\S]*?rememberView\(store, "github"\)/)
    }
  })

  test("is offered in the bar of every screen that is handed it", () => {
    for (const { name, text } of drawn()) {
      if (!/readonly onStepAside\b/.test(text) || !text.includes("<TheBar")) continue

      // A screen handed both keeps its own step aside for a failed read, which is for this page alone.
      const leave = /readonly onUseGitHub\b/.test(text) ? "onStepAside={onUseGitHub}" : "onStepAside={onStepAside}"
      for (const bar of text.match(/<TheBar\b.*?\/>/gs) ?? []) expect(bar, name).toContain(leave)
    }
  })
})
