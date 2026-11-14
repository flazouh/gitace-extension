/**
 * Writes the store's images, headless, from the stage and the sheet that frames it.
 *
 *     bun run assets
 *
 * Starts the shots stage (5199) and the site (5173) if they are down, then:
 *
 *   1. photographs each shot the sheet asks for (`window.__shots`), light, at the size it names and
 *      twice its pixels, into `site/public/shots/<view>-<width>x<height>@2x.png` (gitignored: the
 *      sheet's input, not a deliverable). A shot that names a `focus` has that element scrolled
 *      to its middle first, and where it then stands goes to `site/public/shots/marks.json`, so
 *      the sheet rings it where it is;
 *   2. photographs each `[data-asset]` frame of `site/assets.html` at one pixel per pixel:
 *
 *      site/public/store/icon-128.png      128 by 128, transparent
 *      site/public/store/<picture>.png     1280 by 800, the five screenshots
 *      site/public/store/promo-tile.png    440 by 280
 *      site/public/store/marquee.png       1400 by 560
 *      site/public/og.png                  1200 by 630
 *
 * One pixel per pixel because these are the deliverables, at the only sizes the store takes.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { connect, findChrome } from "./chrome"

const STAGE = "http://localhost:5199"
const SITE = "http://localhost:5173"
const PORT = 9334
const SHOTS = "site/public/shots"
const STORE = "site/public/store"
const ELSEWHERE: Record<string, string> = { "social-card": "site/public/og.png" }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const answers = (url: string): Promise<boolean> =>
  fetch(url, { signal: AbortSignal.timeout(1000) })
    .then((answer) => answer.ok)
    .catch(() => false)

const upIfDown = async (url: string, command: ReadonlyArray<string>, cwd: string): Promise<(() => void) | null> => {
  if (await answers(url)) return null
  const server = Bun.spawn([...command], { cwd, stdout: "ignore", stderr: "ignore" })
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await answers(url)) return () => server.kill()
    await sleep(250)
  }
  server.kill()
  throw new Error(`nothing answered at ${url}`)
}

const stopStage = await upIfDown(STAGE, ["bunx", "vite", "--config", "shots/vite.config.ts", "--port", "5199"], ".")
const stopSite = await upIfDown(`${SITE}/assets.html`, ["bunx", "vite", "--port", "5173"], "site")

const profile = `${homedir()}/.cache/ace-store-assets`
const chrome = Bun.spawn(
  [findChrome(), `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--headless=new",
    "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars", "--window-size=1280,800",
    "about:blank"],
  { stdout: "ignore", stderr: "ignore" }
)

const debuggerAt = async (): Promise<string> => {
  for (let attempt = 0; attempt < 60; attempt++) {
    const seen = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      .then((answer) => answer.json() as Promise<{ webSocketDebuggerUrl: string }>)
      .catch(() => undefined)
    if (seen !== undefined) return seen.webSocketDebuggerUrl
    await sleep(250)
  }
  throw new Error("Chrome never opened its debugging port")
}

const browser = await connect(await debuggerAt())
const { targetId } = await browser.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" })
const targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as ReadonlyArray<{
  id: string
  webSocketDebuggerUrl: string
}>
const target = targets.find((entry) => entry.id === targetId)
if (target === undefined) throw new Error("the page target vanished")
const tab = await connect(target.webSocketDebuggerUrl)
await tab.send("Page.enable")
// In front and focused, or Chrome throttles the tab's frames and a view's smooth scroll stops short.
await tab.send("Page.bringToFront")
await tab.send("Emulation.setFocusEmulationEnabled", { enabled: true })

const js = async <A,>(expression: string): Promise<A> =>
  (await tab.send<{ result: { value: A } }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))
    .result.value

const open = async (url: string, width: number, height: number, scale: number): Promise<void> => {
  await tab.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false })
  const loaded = tab.once("Page.loadEventFired")
  await tab.send("Page.navigate", { url })
  await loaded
  const settled = `(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
    return true
  })()`
  await js(settled)
  await sleep(1200)
}

const png = async (clip?: { x: number; y: number; width: number; height: number }): Promise<Buffer> => {
  const shot = await tab.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
    ...(clip === undefined ? {} : { clip: { ...clip, scale: 1 }, captureBeyondViewport: true })
  })
  return Buffer.from(shot.data, "base64")
}

mkdirSync(SHOTS, { recursive: true })
mkdirSync(STORE, { recursive: true })

await open(`${STAGE}/`, 1440, 900, 1)
const views = await js<ReadonlyArray<{ name: string; width: number; height: number; ready?: string }>>(
  "window.__views"
)

/**
 * Where a view's own `ready` selector is drawn, looking inside shadow roots as `qa-shots.ts` does,
 * or "" while it is not.
 */
const FIND = `const find = (within, want) => within.querySelector(want) ??
  [...within.querySelectorAll("*")].reduce((found, node) => found ?? (node.shadowRoot && find(node.shadowRoot, want)), null)`

const drawnAt = (selector: string) =>
  js<string>(`((want) => {
    ${FIND}
    const at = find(document, want)?.getBoundingClientRect()
    return at === undefined ? "" : [at.x, at.y, at.width, at.height].map(Math.round).join(",")
  })(${JSON.stringify(selector)})`)

const centre = (selector: string) =>
  js<boolean>(`((want) => {
    ${FIND}
    find(document, want)?.scrollIntoView({ block: "center", behavior: "instant" })
    return true
  })(${JSON.stringify(selector)})`)

/** Until the selector is drawn and has stood still for a second: a peek keeps scrolling after it appears. */
const ready = async (selector: string | undefined): Promise<void> => {
  if (selector === undefined) return
  const deadline = Date.now() + 20_000
  let last = ""
  let still = 0
  while (still < 4) {
    if (Date.now() > deadline) throw new Error(`${selector} never stood still`)
    await sleep(250)
    const now = await drawnAt(selector)
    still = now !== "" && now === last ? still + 1 : 0
    last = now
  }
  await sleep(600)
}
await open(`${SITE}/assets.html`, 1600, 1000, 1)
const shots = await js<
  ReadonlyArray<{ view: string; width: number; height: number; file: string; focus?: string }>
>("window.__shots")
const marks: Record<string, { x: number; y: number; width: number; height: number }> = {}
for (const shot of shots) {
  const view = views.find((one) => one.name === shot.view)
  if (view === undefined) throw new Error(`the stage has no view named ${shot.view}`)
  const url = `${STAGE}/?view=${shot.view}&appearance=light&width=${shot.width}&height=${shot.height}`
  await open(url, shot.width, shot.height, 2)
  await ready(view.ready)
  if (shot.focus !== undefined) {
    await centre(shot.focus)
    await ready(shot.focus)
    const [x = 0, y = 0, width = 0, height = 0] = (await drawnAt(shot.focus)).split(",").map(Number)
    marks[shot.file] = { x, y, width, height }
  }
  writeFileSync(`${SHOTS}/${shot.file}@2x.png`, await png())
  console.log(`  shots/${shot.file}@2x.png`)
}
writeFileSync(`${SHOTS}/marks.json`, JSON.stringify(marks, null, 2))

await open(`${SITE}/assets.html`, 1600, 1000, 1)
const frames = await js<ReadonlyArray<string>>(
  `[...document.querySelectorAll("[data-asset]")].map((frame) => frame.dataset.asset)`
)
for (const name of frames) {
  const transparent = name === "icon-128"
  if (transparent) {
    await tab.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })
    await js(`document.body.style.background = "transparent"`)
  }
  const box = await js<{ x: number; y: number; width: number; height: number }>(`(() => {
    const at = document.querySelector('[data-asset="${name}"]').getBoundingClientRect()
    return { x: at.x + scrollX, y: at.y + scrollY, width: at.width, height: at.height }
  })()`)
  const where = ELSEWHERE[name] ?? `${STORE}/${name}.png`
  writeFileSync(where, await png(box))
  if (transparent) {
    await tab.send("Emulation.setDefaultBackgroundColorOverride", {})
    await js(`document.body.style.background = ""`)
  }
  console.log(`  ${where}  ${box.width}x${box.height}`)
}

chrome.kill()
stopSite?.()
stopStage?.()
console.log(`\n${shots.length} shot(s) and ${frames.length} asset(s) written`)
