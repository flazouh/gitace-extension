import type { Screen, Wanted } from "./screens"

/**
 * Every screen, carried by a classic content script on a document that arrived on
 * a pull request. Built by `scripts/build-arrival.ts` from `src/screens/arrival.ts`.
 *
 * A screen imported from a content script is a module, and Chrome may hold a
 * module's fetch and evaluation until GitHub's page has loaded: measured on a large
 * pull request opened directly, its screen ran at 450 to 650 milliseconds after
 * GitHub's first byte in most loads, and at 150 in the rest. A classic script runs
 * as it is injected. Each screen in it is evaluated only when it is asked for.
 *
 * Every screen and not only the pull request's: they share modules that hold the
 * page — who is standing, who handed it over, the settings, the toasts — and a
 * second copy of those beside the shared chunks would be two screens each sure
 * the page is theirs.
 *
 * Its own module, importing nothing at run time, because the arrival script runs
 * whatever it imports the moment it is injected.
 */
export type Arrival = {
  /** What the bundler makes of a dynamic import, which is its API and not ours. */
  readonly screens: Readonly<Record<Wanted, () => PromiseLike<Screen>>>
  /** `screens/styles.css`, as text. */
  readonly css: string
}

/** Where the arrival script leaves itself, on the isolated world's global. */
export const ARRIVAL = "gitaceArrival"
