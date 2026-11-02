/**
 * Every screen in one classic script, for a document that arrived on a pull
 * request. See `Carried` in `src/app/carried.ts`, and `scripts/build-carried.ts`.
 *
 * Imported lazily so that nothing runs until the shell asks: the build inlines
 * each import as a function that evaluates its module on the first call.
 */
import { CARRIED, type Carried } from "@/app/carried"

declare const __CARRIED_CSS__: string

const carried: Carried = {
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
  css: __CARRIED_CSS__
}

;(globalThis as { [CARRIED]?: Carried })[CARRIED] = carried
