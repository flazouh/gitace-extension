/**
 * The Actions list page, read for every Run on it.
 *
 * Scraping, and on purpose, for the same reason the run page is: their list is server-rendered
 * Turbo and one fetch carries all twenty-five rows with the ref, the outcome, the duration and
 * the pull request already on them. The JSON route beside it (`/actions/runs?...`) answers with
 * the same HTML.
 *
 * Written to come back empty rather than wrong. A row whose run link or ref cannot be read is
 * skipped rather than guessed at, so a page that has stopped looking like this yields nothing
 * and the screen can hand the document back to GitHub.
 *
 * Targets what a reader sees. The outcome, the run number and the workflow all come off one
 * `aria-label` that their row prints for a screen reader: "completed successfully:  Run 9857 of
 * ci. fix(events): bound the queue". That label is a sentence about the row, so it survives a
 * redesign in spirit, and it beats reading `.text-bold`, which on the same row is the commit
 * title as often as the workflow. Measured against `tests/fixtures/actionsList.html`.
 */

import { UndefinedOr } from "effect"
import type { CheckState } from "../domain/PullRequest"
import type { Listed, Strand, Workflow } from "../domain/strand"
import { refIn } from "../domain/strand"
import { secondsIn, stateOf, text } from "./outcome"

/** "Run 9857 of ci." out of the row's own label for a screen reader. */
const SAID = /Run\s+(\d+)\s+of\s+(.+?)\.\s/

const RUN = /\/actions\/runs\/(\d+)/

const FILE = /\/actions\/workflows\/(.+)$/

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

const workflowsIn = (page: Document): ReadonlyArray<Workflow> =>
  [...page.querySelectorAll(".actions-workflow-list-item a[href]")].flatMap((link) => {
    const file = FILE.exec(link.getAttribute("href") ?? "")?.[1] ?? ""
    const name = text(link.querySelector(".ActionListItem-label") ?? link)
    return file === "" || name === "" ? [] : [{ name, file }]
  })

/**
 * Which file each Workflow name belongs to, for the names that answer to one file only.
 *
 * Two files may carry one `name:` and GitHub lists both, so a name held twice answers with
 * nothing rather than with the first of them. A row names the name and never the file, so
 * choosing between two candidates would be a guess, and what it decides is which Workflow a
 * reader's Put Away holds, which is the wrong kind of thing to guess at.
 */
const filesIn = (workflows: ReadonlyArray<Workflow>): ReadonlyMap<string, string | null> => {
  const held = new Map<string, string | null>()
  for (const one of workflows) held.set(one.name, held.has(one.name) ? null : one.file)
  return held
}

/**
 * What set the run off, out of the sentence their row prints about it.
 *
 * They write "Pull request #1761 synchronize by flazouh" for one and "by flazouh" alone for a
 * `pull_request_target` run, so the trigger is what is left when the pull request, the actor
 * and their "by" are taken out. Their own wording is kept rather than mapped to an event name:
 * a reader who saw "synchronize" on their page should read "synchronize" here.
 *
 * The actor comes off the end as a suffix and not as a pattern, because an actor is sometimes
 * `devin-ai-integration[bot]` and those brackets mean something else to a regular expression.
 */
const triggerIn = (holder: Element | null | undefined, actor: string): string => {
  const said = text(holder).replace(/\s+/g, " ").replace(/Pull request\s+#\d+/, "")
  const named = said.endsWith(actor) ? said.slice(0, said.length - actor.length) : said
  return named.replace(/\bby\s*$/, "").trim()
}

const rowIn = (
  row: Element,
  files: ReadonlyMap<string, string | null>
): ReadonlyArray<Listed> => {
  const link = row.querySelector('a[href*="/actions/runs/"]')
  const url = link?.getAttribute("href") ?? ""
  const label = link?.getAttribute("aria-label") ?? ""
  const run = RUN.exec(url)?.[1] ?? ""

  const said = SAID.exec(label)
  if (run === "" || said === null) return []

  const who = row.querySelector('[data-hovercard-type="user"]')
  const actor = text(who)
  const pull = row.querySelector('[data-hovercard-type="pull_request"]')
  const pullRequest = pull === null ? null : text(pull).replace(/^#/, "")

  /*
   * Their ref, where the row names one. Five of the twenty-five rows on `oven-sh/bun/actions`
   * name none at all, and each of those is still a run of a pull request the row does name, so
   * a missing ref is a missing field and not a reason to drop the run.
   */
  const ref = row.querySelector("a.branch-name[title]")?.getAttribute("title") ?? ""
  if (ref === "" && pullRequest === null) return []

  /*
   * The outcome off their icon's own label, which says only the outcome.
   *
   * Not off the row's label, which is a sentence with the commit's title in it. On bun's list
   * a commit titled `fix(console): prepend "Assertion failed: " prefix` made every one of its
   * five runs read as a failure, because the word was in the title.
   */
  const icon = link?.querySelector("svg[aria-label]")?.getAttribute("aria-label") ?? ""

  const workflow = said[2] ?? ""

  return [
    {
      run,
      url,
      workflow,
      file: files.get(workflow) ?? null,
      number: said[1] ?? "",
      title: text(row.querySelector(".markdown-title")),
      state: stateOf(icon),
      seconds: secondsIn(text(row.querySelector(".issue-keyword"))),
      startedAt: row.querySelector("relative-time")?.getAttribute("datetime") ?? "",
      actor,
      // The sentence about the trigger is the span the actor's own link sits in.
      trigger: triggerIn(who?.parentElement, actor),
      ref: ref === "" ? null : refIn(ref),
      pullRequest
    }
  ]
}

/**
 * Their list as the React page carries it, in the JSON it renders from.
 *
 * Their list is React as of 2026-11-14: no `.Box-row`, and no label saying
 * "Run 9857 of ci." on any link. The rows come out of `react-app.embeddedData` instead, which
 * names each run's own file, so no Workflow has to be matched up by its `name:`. Measured
 * against `tests/fixtures/actionsReact.html`.
 */
type PayloadRun = {
  readonly id?: string
  readonly runNumber?: number
  readonly runUrl?: string
  readonly workflowName?: string
  readonly workflowFilePath?: string
  readonly title?: string
  readonly state?: { readonly status?: string; readonly conclusion?: string }
  readonly createdAt?: { readonly timestamp?: string }
  readonly branch?: { readonly name?: string; readonly title?: string }
  readonly timing?: { readonly text?: string }
  readonly actions?: { readonly pullRequestUrl?: string }
  readonly description?: {
    readonly primaryText?: string
    readonly linkText?: string
    readonly linkUrl?: string
    readonly action?: string
    readonly actorName?: string
  }
}

type Payload = {
  readonly payload?: {
    readonly allWorkflowRunsRoute?: { readonly workflowRuns?: ReadonlyArray<PayloadRun> }
    readonly workflowsLayoutRoute?: {
      readonly workflows?: ReadonlyArray<{ readonly name?: string; readonly path?: string }>
    }
  }
}

const read = UndefinedOr.liftThrowable((held: string): Payload => JSON.parse(held) as Payload)

const payloadIn = (page: Document): Payload | undefined => {
  const held = page.querySelector("script[data-target='react-app.embeddedData']")?.textContent
  return held === undefined || held === null ? undefined : read(held)
}

const PULL_IN = /\/pull\/(\d+)/

const fileOf = (path: string | undefined): string => path?.split("/").pop() ?? ""

/* Their status while it runs and their conclusion once it ran, in the seven outcomes. */
const STATES_NOW: ReadonlyArray<readonly [string, CheckState]> = [
  ["SUCCESS", "succeeded"],
  ["FAILURE", "failed"],
  ["TIMED_OUT", "failed"],
  ["STARTUP_FAILURE", "failed"],
  ["CANCELLED", "cancelled"],
  ["SKIPPED", "skipped"],
  ["ACTION_REQUIRED", "queued"],
  ["IN_PROGRESS", "running"],
  ["QUEUED", "queued"],
  ["WAITING", "queued"],
  ["PENDING", "queued"],
  ["REQUESTED", "queued"]
]

const stateNow = (state: PayloadRun["state"]): CheckState => {
  const said = state?.status === "WORKFLOW_RUN_STATUS_COMPLETED" ? state.conclusion : state?.status
  return STATES_NOW.find(([name]) => said?.endsWith(`_${name}`) === true)?.[1] ?? "neutral"
}

const payloadRun = (one: PayloadRun): ReadonlyArray<Listed> => {
  const run = one.id ?? ""
  const workflow = one.workflowName ?? ""
  if (run === "" || workflow === "" || one.runNumber === undefined) return []

  const said = one.description
  const pull = PULL_IN.exec(one.actions?.pullRequestUrl ?? said?.linkUrl ?? "")?.[1] ?? null
  const named = refIn(one.branch?.name ?? "")
  const ref = named.kind === "pull" ? named : refIn(one.branch?.title ?? "")
  if (ref.kind === "branch" && ref.name === "" && pull === null) return []

  /* Their own words, as on the old page: "synchronize" for a pull request, "Commit f6fbaf0 pushed" otherwise. */
  const trigger =
    pull !== null && said?.linkUrl?.includes("/pull/") === true
      ? (said.action ?? "")
      : [said?.primaryText, said?.linkText, said?.action].filter((word) => word !== undefined).join(" ")

  return [
    {
      run,
      url: one.runUrl === undefined ? "" : new URL(one.runUrl, "https://github.com").pathname,
      workflow,
      file: fileOf(one.workflowFilePath) || null,
      number: String(one.runNumber),
      title: one.title ?? "",
      state: stateNow(one.state),
      seconds: secondsIn(one.timing?.text ?? ""),
      startedAt: one.createdAt?.timestamp ?? "",
      actor: said?.actorName ?? "",
      trigger,
      ref: ref.kind === "branch" && ref.name === "" ? null : ref,
      pullRequest: pull
    }
  ]
}

/**
 * Every Run their list page carries, in the order they gave them.
 *
 * The order is theirs, which is newest first, and it is kept: grouping reads it to date each
 * Strand and a re-sort here would make that a second opinion.
 */
export const runsOnPage = (html: string): ReadonlyArray<Listed> => {
  const page = parse(html)
  const runs = payloadIn(page)?.payload?.allWorkflowRunsRoute?.workflowRuns
  if (runs !== undefined) return runs.flatMap(payloadRun)
  const files = filesIn(workflowsIn(page))
  return [...page.querySelectorAll(".Box-row")].flatMap((row) => rowIn(row, files))
}

/**
 * Every Workflow the list down the side of their page names, in their order.
 *
 * Read out of the same document as the rows, at the cost of one more pass over it and no
 * second request. Their list of Workflows is a filter and this screen groups, so it is drawn
 * nowhere, which `ACTIONS` in `src/ui/place.ts` argues. It is still the only place on the page
 * that says which file a Workflow is, and a Run's row is labelled with a `name:` that anybody
 * can edit in a commit.
 *
 * The first page of it, which is what their own sidebar shows: past twenty or so Workflows
 * they hide the rest behind a "Show more workflows" press that fetches
 * `/actions/workflows_partial`. Not followed. A Run of a Workflow that far down the list comes
 * back with no file and is named by its `name:`, which is what a reader sees anyway.
 */
export const workflowsOnPage = (html: string): ReadonlyArray<Workflow> => {
  const page = parse(html)
  const listed = payloadIn(page)?.payload?.workflowsLayoutRoute?.workflows
  if (listed === undefined) return workflowsIn(page)
  return listed.flatMap(({ name = "", path }) => {
    const file = fileOf(path)
    return name === "" || file === "" ? [] : [{ name, file }]
  })
}

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * The same guard a run keeps, and for the same reason: an entry written before an update is
 * the one shape that would reach the screen and fail there. One row is enough to tell — they
 * are written in one go by one version of this code.
 */
export const isKeptStrands = (value: unknown): value is ReadonlyArray<Strand> => {
  if (!Array.isArray(value)) return false
  if (value.length === 0) return true

  const one: Partial<Strand> = value[0]
  if (
    typeof one !== "object" ||
    one === null ||
    typeof one.head !== "string" ||
    typeof one.state !== "string" ||
    !Array.isArray(one.latest) ||
    !Array.isArray(one.runs)
  ) {
    return false
  }

  /*
   * One Run's own fields as well as the Strand's, because the field a Run gained is the one Put
   * Away is keyed on. An entry written before it would paint a Workflow the reader put away, and
   * then lose it when the live read landed a moment later, which is one screen giving two
   * answers about what is on it. Refused instead, and the first paint waits: that is what a
   * first visit to a repository does anyway.
   */
  const run: Partial<Listed> | undefined = one.runs[0]
  return run !== undefined && (typeof run.file === "string" || run.file === null)
}
