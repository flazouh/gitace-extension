/**
 * Where each browser installs the extension, and which of them the reader is in.
 *
 * Chrome's listing serves every Chromium browser: Edge, Brave, Arc and Opera install
 * from it too. Firefox has Mozilla's listing. Safari has no App Store listing yet, so
 * its way in is the disk image on the latest GitHub release.
 */

export type Browser = "chrome" | "firefox" | "safari"

export type Store = {
  readonly browser: Browser
  /** The browser's own name, as the footer and the tag say it. */
  readonly name: string
  readonly at: string
  /** What the install button says when this is the reader's browser. */
  readonly press: string
}

/** The item id is the store's record of this extension, kept through the rename so updates still arrive. */
export const CHROME_AT =
  "https://chromewebstore.google.com/detail/gitace-extension/ichobjnihnofjkpoegikjhefmoekaahe"

/** The slug is from before the rename; Mozilla keeps it for the listing's life. */
export const FIREFOX_AT = "https://addons.mozilla.org/firefox/addon/gitquiet/"

export const SAFARI_AT = "https://github.com/flazouh/gitace-extension/releases/latest"

export const STORES: Readonly<Record<Browser, Store>> = {
  chrome: { browser: "chrome", name: "Chrome", at: CHROME_AT, press: "Install for Chrome" },
  firefox: { browser: "firefox", name: "Firefox", at: FIREFOX_AT, press: "Install for Firefox" },
  safari: { browser: "safari", name: "Safari", at: SAFARI_AT, press: "Get it for Safari" }
}

const ORDER: ReadonlyArray<Browser> = ["chrome", "firefox", "safari"]

/**
 * The reader's browser, from its user agent.
 *
 * Every Chromium browser and every browser this cannot name gets Chrome, which is the
 * listing most readers can use. Safari is the one whose agent says Safari and none of
 * the Chromium or Firefox names, since all of those say Safari as well.
 */
export const browserIn = (agent: string): Browser => {
  if (/Firefox\/|FxiOS\//.test(agent)) return "firefox"
  if (/Safari\//.test(agent) && !/Chrome\/|Chromium\/|CriOS\/|Edg\/|EdgiOS\/|OPR\//.test(agent)) return "safari"
  return "chrome"
}

/** "Also on Firefox and Safari", from whichever two the reader is not in. */
export const alsoOn = (browser: Browser): string => {
  const others = ORDER.filter((one) => one !== browser).map((one) => STORES[one].name)
  return `Also on ${others.join(" and ")}`
}

/** The reader's store. Read once per page, since a browser does not change under a page. */
export const theirStore = (): Store =>
  STORES[browserIn(typeof navigator === "undefined" ? "" : navigator.userAgent)]
