/**
 * Every screen in one classic script, for a document that arrived on a pull
 * request. See `Arrival` in `src/app/arrival.ts`, and `scripts/build-arrival.ts`.
 *
 * Imported lazily so that nothing runs until the shell asks: the build inlines
 * each import as a function that evaluates its module on the first call.
 */
import { ARRIVAL, type Arrival } from "@/app/arrival"

declare const __ARRIVAL_CSS__: string

const arrival: Arrival = {
  screens: {
    "pull-request": () => import("./pullRequest"),
    commit: () => import("./commit"),
    commits: () => import("./commits"),
    "working-set": () => import("./workingSet"),
    "repo-pulls": () => import("./repoPulls"),
    "repo-home": () => import("./repoHome"),
    issue: () => import("./issue"),
    "repo-issues": () => import("./repoIssues"),
    raise: () => import("./raise"),
    issues: () => import("./issues"),
    blame: () => import("./blame"),
    run: () => import("./run"),
    actions: () => import("./actions"),
    releases: () => import("./releases"),
    discussions: () => import("./discussions"),
    discussion: () => import("./discussion"),
    notifications: () => import("./notifications"),
    "person-repos": () => import("./personRepos"),
    profile: () => import("./profile"),
    compare: () => import("./compare"),
    "sign-on": () => import("./signOn")
  },
  css: __ARRIVAL_CSS__
}

;(globalThis as { [ARRIVAL]?: Arrival })[ARRIVAL] = arrival
