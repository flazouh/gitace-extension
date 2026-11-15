import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { Effect, Option } from "effect"
import type { AcrossUse, Use, Writing } from "../ports/Ledger"
import { CHIP, FLOAT } from "./dress"
import { OVER_ID, outsideHost } from "./outside"
import { partOfFile } from "../domain/wholeFile"
import type { Changes } from "../domain/changes"
import { diffChoices } from "../domain/choices"
import type { Bounds, DiffEngine } from "../ports/Renderer"
import { PAPER } from "../ports/Renderer"
import { onward, onwardWith } from "../observability/report"
import { useMarkdownDraw } from "../markdown/runtime"
import { FileMark } from "./FileHeading"
import { useLedger } from "./ledger"
import { useRenderer } from "./renderer"
import { drawnIn } from "./showLine"
import { usePaintedTheme } from "./Theme"
import { useSettings } from "./useSettings"
import { SpinnerIcon } from "./spinner"
import { languageOf, listing, shortPath, summary, type Hit } from "./usesListing"

/**
 * Everywhere in this file that means the same Writing.
 *
 * Counted by name and not by word: `shape` inside a function that declares its
 * own `shape` is a different thing with the same spelling, and a list that held
 * it would be a list of a word rather than of a name. `src/ledger/writings.ts`
 * resolves every one of them; this draws what comes back.
 *
 * This file first, because it is the question asked most and the only one that
 * can be answered exactly: the reader's own file is parsed, and every mention in
 * it is resolved by scope.
 *
 * Then the repository, where a Ledger has read one. That half cannot be exact
 * without parsing every file at the moment of asking, so it is not pretended to
 * be: a file that states it borrowed this name from this file is **Sure**, a
 * file that merely holds the same word is **Likely** and says so, and a file
 * that binds its own name of that spelling is left out — two things with one
 * spelling are two things.
 */
export type UsesPanelProps = {
  readonly writing: Writing
  readonly reading: { readonly path: string; readonly text: string }
  /**
   * Where the name is on the screen, for this to open beside it.
   *
   * This used to be a row the renderer hung under the line, and the line number
   * was all it needed. That put the answer inside the drawing it was about,
   * which is where it came apart: a press in the preview bubbled out into the
   * file's own renderer, which followed it too and re-opened this on a new
   * root, so a name in the preview could not be followed at all. A popup over
   * the code has no such parent to escape into.
   */
  readonly at: Bounds
  /**
   * The line the reader asked from, which decides whether where it is written
   * is worth a row. See {@link UsesPanelProps.writing} and the note on `rows`.
   */
  readonly under: number
  /**
   * The file the Writing is in, where it is not the one being read.
   *
   * A name this file borrowed is written somewhere else, and this file's own
   * mentions of it are then Uses like any other file's — so the exact in-file
   * list is skipped and the repository answers for all of them, this one
   * included. Resolving a Writing from another file against this file's text
   * would match nothing at all, which would read as "used nowhere".
   */
  readonly where?: string
  /** Puts one on the screen. The pane scrolls; the address does not change. */
  /**
   * Scrolls to a line of this file, and says whether it could.
   *
   * It can fail. In a pull request's diff the Uses are the whole file's, and the
   * diff draws only its hunks: a use on a line folded into an "unmodified lines"
   * bar has no row to scroll to.
   */
  readonly onGo: (line: number) => boolean
  readonly onClose: () => void
  /**
   * Opens another file at a line, where the screen can.
   *
   * Separate from {@link UsesPanelProps.across} on purpose: going to a file is
   * not the same capability as asking a Ledger about a repository, and a screen
   * that can do the first and not the second was a screen where the row saying
   * where a name is written did nothing at all.
   */
  readonly onOpen?: (path: string, line: number) => void
  /**
   * Which repository to ask about the rest of the Uses, at which commit.
   *
   * Absent where the screen does not know, and then this is the file's Uses and
   * says so — rather than an empty list of the repository's, which a reader
   * deciding whether a name is safe to change would read as an answer.
   */
  readonly across?: {
    readonly repo: { readonly owner: string; readonly repo: string }
    readonly sha: string
    /**
     * Reads another file whole, at that commit, so a use in it is shown as the
     * line of code it is rather than as the path it is in.
     */
    readonly read?: (path: string) => Effect.Effect<string, unknown>
  }
  /**
   * What the pull request changed, where this is a pull request: which files, and
   * which of their lines it adds. The head says how many of the uses it wrote, and
   * the preview marks the lines it added.
   */
  readonly changes?: Changes
}

/**
 * What the Ledger came back with about the rest of the repository.
 *
 * Named rather than written inline at the `useState`, because it is also what
 * is answered with when the asking fails — and an answer given in two places
 * has to be one shape in both.
 */
type Elsewhere = {
  readonly uses: ReadonlyArray<AcrossUse>
  readonly ready: boolean
  readonly exact?: boolean
}

/**
 * What is shown where the Ledger could not answer: nothing, and not ready.
 *
 * `ready: false` rather than an empty list of Uses, because the two read very
 * differently to somebody deciding whether a name is safe to change. An empty
 * list that says it is ready is the claim that nobody depends on this. This is
 * the admission that nobody asked successfully.
 */
const UNANSWERED: Elsewhere = { uses: [], ready: false }

/** How many lines of context the preview shows either side of a row. */
const AROUND = 8

/**
 * Files read whole for the lines of their uses, kept by commit and path.
 *
 * A file at a commit does not change, and a reader who presses five names in one
 * pull request meets the same few files under each. Null is a file that would not
 * come, kept as such so the list says so rather than asking again on every name.
 */
const KEPT = new Map<string, string | null>()
/** How many files are kept before the oldest is let go. */
const MOST_KEPT = 120
const keptAs = (sha: string, path: string): string => `${sha}:${path}`

/** How many of those files are read at once. */
const AT_ONCE = 4

/** The widths of the bars that stand in for lines still on their way. */
const WAITING = ["62%", "48%", "71%", "35%", "56%", "44%"]

/**
 * How the panel was last left, kept for the next time it opens.
 *
 * On the module rather than in settings: the settings here are knobs with named
 * choices, and a ratio is neither. This is the same scope VS Code gives it —
 * a `layoutData` object on the widget, seven parts to three and eighteen lines
 * tall until somebody drags it otherwise — and like theirs it is remembered for
 * the rest of the visit rather than for ever. A reader who makes the list wider
 * to read a long path does not want it narrow again at the next name.
 */
const LAYOUT = { ratio: 0.58, tall: 300 }
/** Neither half may be dragged smaller than this, in pixels. */
const LEAST = { preview: 168, listed: 200 }
/** The panel itself, which is a reader's window and not a reader's file. */
const SHORTEST = 120
const TALLEST = 440

/**
 * How wide the popup is, in pixels, and how far above the word it sits.
 *
 * A number rather than a class because it is also what the clamping is done
 * against: a popup anchored to a word near the right edge has to be pulled back
 * onto the screen, and that arithmetic needs the width.
 *
 * Narrower than the row this replaced, which was as wide as the file. A popup
 * covers the code it is about, so every column of it is a column of the
 * reader's file spent — the row could afford to be wide because it pushed the
 * file down rather than sitting on it. Wide enough, though, for the list to
 * show a line of code beside each line number, which is what a row is now.
 */
const WIDE = 760
const CLEAR = 8
/** Above the word unless the word is nearer the top of the window than this. */
const ROOM = 280

/** One name on the trail: a Writing, and the file it is written in. */
type Step = { readonly writing: Writing; readonly where?: string }

/**
 * Lines of code, coloured by the highlighter the screens' markdown already uses.
 *
 * One request for a file's rows rather than one per row: the list can hold a
 * hundred lines, and on GitHub's page each request is a message to the
 * background. Plain until the colours come, and plain for good in a language the
 * highlighter does not carry, which is legible either way.
 */
const useColoured = (lines: ReadonlyArray<string>, path: string): ReadonlyArray<string> | null => {
  const { highlight, syntaxTheme } = useMarkdownDraw()
  const code = lines.join("\n")
  const language = languageOf(path)
  const [drawn, setDrawn] = useState<{ readonly of: string; readonly html: ReadonlyArray<string> } | null>(null)

  useEffect(() => {
    if (language === "" || code === "") return
    const asking = Effect.runFork(
      highlight(code, language, syntaxTheme).pipe(
        Effect.map((html) => {
          if (html !== null) setDrawn({ of: code, html: html.split("<br>") })
        })
      )
    )
    return () => asking.interruptUnsafe()
  }, [code, language, highlight, syntaxTheme])

  return drawn?.of === code ? drawn.html : null
}

/** A bar the height of a line of text, standing in for one still on its way. */
const Waiting = ({ wide }: { readonly wide: string }) => (
  <span aria-hidden className="block h-2.5 rounded-sm bg-hover" style={{ width: wide }} />
)

/** What a row needs from the list it is in: whether it is the one showing, and what pressing it does. */
type RowHands = {
  readonly picked: boolean
  readonly ref: (node: HTMLButtonElement | null) => void
  readonly onPick: () => void
  readonly onGo: () => void
}

/**
 * One file's rows, under its name.
 *
 * The name is the last folder and the file, in a chip: a list of twenty rows
 * whose paths all begin `apps/desktop/src/` and are cut off there tells a reader
 * nothing, and the end of a path is the part that differs. The whole of it is in
 * the title, for the two files that end the same.
 */
const UsesGroup = ({
  group,
  tag,
  text,
  icons,
  row
}: {
  readonly group: { readonly path: string; readonly hits: ReadonlyArray<Hit> }
  /** "this file", or "in this PR" where that tells the files apart. */
  readonly tag?: "this file" | "in this PR"
  /** The file's text: absent while it is read, null where it would not come. */
  readonly text: string | null | undefined
  readonly icons: "material" | "plain"
  readonly row: (hit: Hit) => RowHands
}) => {
  const lines = useMemo(() => (typeof text === "string" ? text.split("\n") : null), [text])
  const said = group.hits.map((hit) => (lines === null ? (hit.said ?? "") : (lines[hit.line - 1] ?? "")).trim())
  const coloured = useColoured(text === undefined ? [] : said, group.path)

  return (
    <li className="pb-1">
      <div className="flex items-center gap-1.5 px-2 pb-0.5 pt-1.5">
        <span className={`${CHIP} flex min-w-0 items-center`} title={group.path}>
          <FileMark path={shortPath(group.path)} icons={icons} />
        </span>
        {tag === undefined ? null : (
          <span className={`shrink-0 text-xs ${tag === "this file" ? "text-ink-muted" : "text-ink-accent"}`}>
            {tag}
          </span>
        )}
        <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-ink-muted">{group.hits.length}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {group.hits.map((hit, at) => {
          const hands = row(hit)
          const html = coloured?.[at]
          return (
            <li key={`${hit.line}:${hit.from ?? 0}`}>
              <button
                type="button"
                ref={hands.ref}
                // Only the row the preview is showing is in the tab order, so
                // Tab leaves this list rather than walking every use in it.
                tabIndex={hands.picked ? 0 : -1}
                // Showing on hover as well as on focus: a reader running the
                // pointer down the list is reading the code beside it, which is
                // the whole reason the code is there.
                onMouseEnter={hands.onPick}
                onFocus={hands.onPick}
                onClick={hands.onGo}
                /*
                 * Dimmed where the answer is not proven, and worded nowhere.
                 *
                 * This carried a word on every row of the repository's half —
                 * `Sure` on the ones that are, `Likely` on the ones that are
                 * not, the second in the colour that means attention. So the
                 * rows a reader can least rely on were the loudest thing in the
                 * list, and the ordinary case spent a word saying it was
                 * ordinary.
                 *
                 * An editor's list of references carries no such labels, and a
                 * reader scanning for a line of code should not be reading
                 * badges. The distinction is worth keeping — a rename is only
                 * as safe as the list is complete — so it is kept as less ink
                 * rather than as more text: an unproven row is quieter, and
                 * nothing else about it changes.
                 */
                className={`flex w-full items-baseline gap-2 border-0 py-0.5 outline-none pl-7 pr-3 text-left font-mono text-xs leading-5 ${
                  hands.picked ? "bg-active" : "bg-transparent hover:bg-hover"
                } ${hit.sure ? "" : "opacity-60"}`}
              >
                <span className="w-8 shrink-0 text-right tabular-nums text-ink-muted">{hit.line}</span>
                {text === undefined ? (
                  <span className="min-w-0 flex-1 self-center">
                    <Waiting wide={WAITING[at % WAITING.length] ?? "50%"} />
                  </span>
                ) : html === undefined ? (
                  <span className="min-w-0 flex-1 truncate">{said[at]}</span>
                ) : (
                  <span className="min-w-0 flex-1 truncate" dangerouslySetInnerHTML={{ __html: html }} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

export const UsesPanel = ({
  writing,
  reading,
  at,
  under,
  onGo,
  onOpen,
  onClose,
  across,
  changes,
  where
}: UsesPanelProps) => {
  /**
   * How far the reader has walked from the name they started on.
   *
   * A Peek shows what a name is. The question a reviewer asks next is almost
   * always what *that* calls, and the one after that the same again — which
   * until now meant closing this, finding the name in the file, holding the
   * key and pressing it, three times, with the thread of the question carried
   * in the reader's head between each.
   *
   * So the panel keeps a trail. Following a name inside the preview pushes a
   * step; Escape takes one back and only closes at the root. The root itself is
   * the props, which is why this is a list of what came after rather than a
   * list including it.
   */
  const [trail, setTrail] = useState<ReadonlyArray<Step>>([])
  const step: Step = trail.at(-1) ?? { writing, where }
  /** Whether the Writing is in the file being read, which decides what can be exact. */
  const here = step.where === undefined || step.where === reading.path
  const ledger = useLedger()
  // Whether the reader asked for a compiler to answer. Off, and this is the
  // tier that reads shapes — fast, every language, honest about its guesses.
  const { settings, change } = useSettings()
  const exact = settings.diff.exact === "on"
  const shown = { imports: settings.diff.usesImports === "on", tests: settings.diff.usesTests === "on" }
  /** Which row the preview is showing, as an index into the rows below. */
  const [picked, setPicked] = useState(0)
  /** The split, and the height, as the reader last left them. */
  const [ratio, setRatio] = useState(LAYOUT.ratio)
  const [tall, setTall] = useState(LAYOUT.tall)
  const body = useRef<HTMLDivElement | null>(null)
  /** The popup, for a press to be asked whether it landed inside it. */
  const frame = useRef<HTMLDivElement | null>(null)
  /** Where the preview is drawn, by the renderer that drew the file above it. */
  const shownIn = useRef<HTMLDivElement | null>(null)
  const load = useRenderer()
  const painted = usePaintedTheme()
  const [engine, setEngine] = useState<DiffEngine | null>(null)
  /** Drawn the way the file above it is drawn, which is what the reader chose. */
  const choices = useMemo(() => diffChoices(settings.diff), [settings.diff])
  /** The rows, so the arrow keys can move between them. */
  const listed = useRef<Array<HTMLButtonElement | null>>([])
  const [uses, setUses] = useState<ReadonlyArray<Use> | null>(null)
  const [elsewhere, setElsewhere] = useState<Elsewhere | null>(null)
  /**
   * The repository's Uses, minus the ones in the file already listed above.
   *
   * The Ledger answers about every file including this one, and this one is
   * answered exactly a few lines up. Listing both would be the same lines twice,
   * once precisely and once by a rule that cannot see scopes.
   */
  const across_ = (elsewhere?.uses ?? []).filter((use) => !here || use.path !== reading.path)

  /**
   * And only the proven ones, where there are any.
   *
   * A file that states it borrowed this name is an answer. A file that merely
   * holds the word is a maybe, and a maybe costs more than it gives once there
   * are answers beside it: a reader asking whether a rename is safe follows a
   * row, and a row that leads to a different thing of the same spelling has
   * taken them somewhere and told them it is the place.
   *
   * Kept where there is nothing else, because then the maybe is the whole of
   * what is known and the difference it makes is between a list and none. Those
   * are the rows drawn quietly — see the note on the row below.
   *
   * Barrels are why this is affordable now. A name re-exported through one used
   * to arrive unproven for every file that imported it, which on a repository
   * with a barrel in front of each folder was most of the list; `uses.ts`
   * follows the chain, so what is left unproven is what really cannot be shown
   * to be the same thing — a dynamic import, a plain `.js` file, a specifier
   * nothing here can resolve.
   */
  const proven = across_.filter((use) => use.sure === true)
  const beyond = proven.length > 0 ? proven : across_

  /** The uses worth a row, which is every one that is not the writing itself. */
  const elsewhereInFile =
    uses === null ? null : uses.filter((use) => use.line !== step.writing.line || use.from !== step.writing.from)

  /*
   * Escape puts it away, which is what Escape means everywhere else here.
   *
   * On the document and in the capture phase: this row lives inside the
   * renderer's shadow root, and a key pressed over it is reported against
   * whatever the event was retargeted to.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      // Back one name before out altogether. A reader three deep in a call
      // chain who wanted the step before it should not have to open the panel
      // again and walk the whole way down.
      setTrail((walked) => {
        if (walked.length === 0) {
          onClose()
          return walked
        }
        setPicked(0)
        return walked.slice(0, -1)
      })
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [onClose])

  /*
   * A press anywhere else puts it away, which is what a popup means.
   *
   * The row this replaced needed a button to close it, because a row has no
   * outside — it is part of the file, and pressing the file is reading the
   * file. A popup sits over the code and the code around it is the way out, so
   * the button is gone and this is what took its place.
   *
   * `composedPath` rather than `contains`: the preview inside this is drawn by
   * the renderer into a shadow root of its own, so a press on a line of it
   * reports a target that is retargeted to the host and belongs to no node this
   * could ask about. The composed path holds every node the event really
   * crossed, this popup among them.
   *
   * On pointerdown rather than click, and in the capture phase. A press that
   * starts outside has already left; waiting for the click let the same press
   * land on the file underneath first — marking a line, or opening a composer
   * on it — and then closed this afterwards.
   */
  useEffect(() => {
    const away = (event: Event) => {
      const popup = frame.current
      if (popup === null || event.composedPath().includes(popup)) return
      onClose()
    }

    /*
     * And a scroll of the page counts as leaving.
     *
     * The rectangle this is placed at was measured once and the popup is fixed
     * to the viewport, so a scrolled page slides the code out from under it and
     * leaves it pointing at a line that has moved. `FollowCard` and
     * `BeyondCard` are cleared on a scroll for the same reason; this is the
     * same rule for a panel that can be scrolled inside.
     *
     * Which is why the path is asked about here too: the list scrolls, the
     * preview scrolls, and neither is the reader leaving. Only a scroll that
     * did not start inside this popup is.
     */
    document.addEventListener("pointerdown", away, true)
    window.addEventListener("scroll", away, true)
    return () => {
      document.removeEventListener("pointerdown", away, true)
      window.removeEventListener("scroll", away, true)
    }
  }, [onClose])

  /*
   * The first row takes the focus, which is what opens this to a keyboard.
   *
   * Without it the answer appeared and the focus stayed wherever the reader had
   * left it — the list could be tabbed into eventually, from somewhere else on
   * a page that is mostly a file, and the arrow keys did nothing at all. A
   * panel a reader can open and cannot move through is a panel for one kind of
   * reader.
   */
  useEffect(() => {
    /*
     * Waited for, because the row is not on the page when this first renders.
     *
     * The panel is drawn into an element the renderer has not been handed yet:
     * React fills the row, an effect tells the renderer about it, and the
     * renderer puts it under the line. Focusing in between focuses a node
     * attached to nothing, which does nothing and reports nothing — the panel
     * simply opened with the focus still wherever the reader had left it.
     */
    let frame = 0
    let tries = 0
    const reach = () => {
      const first = listed.current[0]
      if (first?.isConnected === true) {
        first.focus()
        return
      }
      // Bounded: a row that never arrives is a row nobody can focus, and a
      // loop asking for ever costs a frame a frame for the life of the pane.
      if (tries++ > 30) return
      frame = requestAnimationFrame(reach)
    }
    frame = requestAnimationFrame(reach)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!here) {
      setUses([])
      return
    }

    const asking = Effect.runFork(
      ledger.usesIn(reading, step.writing).pipe(
        Effect.catch(onwardWith<ReadonlyArray<Use>>([])),
        Effect.map(setUses)
      )
    )
    return () => asking.interruptUnsafe()
  }, [here, ledger, reading, step.writing])

  /*
   * The rest of the repository, where there is a Ledger that has read it.
   *
   * Warmed first: a reader who presses this without having opened Go to Name is
   * asking the repository a question for the first time, and being told "no
   * Ledger" would be being told about a mechanism rather than answered.
   */
  useEffect(() => {
    if (across === undefined) return

    const asking = Effect.runFork(
      ledger.warm(across.repo, across.sha, exact).pipe(
        Effect.flatMap(() =>
          ledger.usesAcross(across.repo, across.sha, {
            name: step.writing.name,
            path: step.where ?? reading.path,
            line: step.writing.line,
            column: step.writing.from - 1
          })
        ),
        Effect.catch(onwardWith(UNANSWERED)),
        Effect.map(setElsewhere)
      )
    )
    return () => asking.interruptUnsafe()
  }, [ledger, across, exact, reading.path, step.where, step.writing])

  /**
   * Whether where it is written is worth a row.
   *
   * It is not, when the reader is looking at it. A press on a Writing is a
   * reader with their eye on the declaration asking who depends on it — and the
   * first thing the panel did was offer them the line they had just pressed,
   * with the preview opened on the body they could already see. The question
   * was "who uses this" and the answer led with "here it is".
   *
   * It is worth a row in the two cases where it is news: where the Writing is
   * in another file, which is then the only way to reach it, and on a step
   * along the trail, where the reader followed a name precisely to find out
   * what it is.
   */
  const written = trail.length > 0 || !here || step.writing.line !== under

  /** Where it is written, which is the file being read unless the trail left it. */
  const writtenIn = step.where ?? reading.path

  const hits: ReadonlyArray<Hit> = [
    ...(written
      ? [
          {
            path: writtenIn,
            line: step.writing.line,
            from: step.writing.from,
            to: step.writing.to,
            written: true,
            sure: true,
            imported: false,
            said: step.writing.signature
          }
        ]
      : []),
    ...(elsewhereInFile ?? []).map((use) => ({
      path: reading.path,
      line: use.line,
      from: use.from,
      to: use.to,
      written: false,
      sure: true,
      imported: false
    })),
    ...beyond
      // The repository answers with where the name is written as one of its own
      // mentions, and that line is already the row above.
      .filter((use) => use.path !== writtenIn || use.line !== step.writing.line || use.from !== step.writing.from)
      .map((use) => ({
        path: use.path,
        line: use.line,
        from: use.from,
        to: use.to,
        written: false,
        sure: use.sure,
        imported: use.imported === true
      }))
  ]

  const listed_ = listing(hits, reading.path, shown)
  /** The rows in the order they are drawn, which is what the arrow keys and the preview count in. */
  const rows = listed_.groups.flatMap((group) => group.hits)
  const showing = rows[Math.min(picked, rows.length - 1)] ?? rows[0]
  /** Whether the answer is still on its way, which is never said as an empty list. */
  const waiting = uses === null || (across !== undefined && elsewhere === null)

  /*
   * The other files the list names, read whole for their lines.
   *
   * Every file with a use, the hidden ones too, so ticking a box shows lines that
   * are already there rather than a second wait. Keyed by the paths and not by the
   * rows, which are built fresh on every render.
   */
  const read = useRef(across?.read)
  read.current = across?.read
  const sha = across?.sha
  const others = [...new Set(hits.map((hit) => hit.path))].filter((path) => path !== reading.path).sort()
  const othersKey = others.join("\n")
  const [texts, setTexts] = useState<ReadonlyMap<string, string | null>>(new Map())

  useEffect(() => {
    const reading_ = read.current
    if (sha === undefined || reading_ === undefined || othersKey === "") return
    const paths = othersKey.split("\n")
    const known = new Map<string, string | null>()
    for (const path of paths) {
      const kept = KEPT.get(keptAs(sha, path))
      if (kept !== undefined) known.set(path, kept)
    }
    setTexts(known)

    const keep = (path: string, text: string | null) =>
      Effect.sync(() => {
        KEPT.set(keptAs(sha, path), text)
        if (KEPT.size > MOST_KEPT) KEPT.delete(KEPT.keys().next().value ?? "")
        setTexts((was) => new Map(was).set(path, text))
      })
    const asking = Effect.runFork(
      Effect.forEach(
        paths.filter((path) => !known.has(path)),
        (path) =>
          reading_(path).pipe(
            Effect.flatMap((text) => keep(path, text)),
            // A file that would not come is one row that cannot show its line, not
            // the end of the list. Reported, because `onward` is the only trace kept.
            Effect.catch((cause) => onward(cause).pipe(Effect.andThen(keep(path, null))))
          ),
        { concurrency: AT_ONCE, discard: true }
      )
    )
    return () => asking.interruptUnsafe()
  }, [sha, othersKey])

  /**
   * A file's text, wherever it is: this one is in hand, the rest are read above,
   * and where nothing can read them they are files that will not come.
   */
  const textOf = (path: string): string | null | undefined =>
    path === reading.path ? reading.text : sha === undefined || across?.read === undefined ? null : texts.get(path)

  /*
   * Which lines the pull request adds, for the files it changed that the list names.
   *
   * Asked of the same diffs the screen draws, so a file the reader has opened costs
   * nothing. Until every one has answered, the head says the counts and not the
   * share, rather than a share of some of them.
   */
  const changing = useRef(changes)
  changing.current = changes
  const touched = [...new Set(hits.filter((hit) => !hit.written).map((hit) => hit.path))]
    .filter((path) => changes?.paths.has(path) === true)
    .sort()
  const touchedKey = touched.join("\n")
  const [adds, setAdds] = useState<ReadonlyMap<string, ReadonlySet<number>>>(new Map())

  useEffect(() => {
    const asked = changing.current
    if (asked === undefined || touchedKey === "") return
    const asking = Effect.runFork(
      Effect.forEach(
        touchedKey.split("\n"),
        (path) =>
          asked.added(path).pipe(
            Effect.map((lines) => setAdds((was) => (was.has(path) ? was : new Map(was).set(path, lines))))
          ),
        { concurrency: AT_ONCE, discard: true }
      )
    )
    return () => asking.interruptUnsafe()
  }, [touchedKey])

  const addedIn = (path: string): ReadonlySet<number> | undefined => adds.get(path)
  const added =
    changes === undefined || waiting || touched.some((path) => !adds.has(path))
      ? undefined
      : listed_.uses.filter((hit) => addedIn(hit.path)?.has(hit.line) === true).length
  /** Whether "in this PR" says anything: where every file listed is in it, it is a word on every row. */
  const allChanged =
    changes !== undefined && listed_.groups.every((group) => changes.paths.has(group.path))

  /**
   * The lines behind whichever row is showing, in whichever file it is.
   *
   * Code, always. A row in another file used to say its path and "press to open
   * it", which made the list two lists — one of code and one of places — and the
   * preview, the half of the panel that answers the question, blank for most of
   * the answer.
   */
  const shownText = showing === undefined ? undefined : textOf(showing.path)
  const previewFrom = showing === undefined ? 1 : Math.max(1, showing.line - AROUND)
  const patch =
    showing === undefined
      ? Option.none<string>()
      : typeof shownText === "string"
        ? partOfFile(
            showing.path,
            shownText.split("\n").slice(previewFrom - 1, showing.line - 1 + AROUND + 1),
            previewFrom,
            addedIn(showing.path)
          )
        : // A file that will not come still has its Writing's line, which is the line asked about.
          shownText === null && showing.said !== undefined
          ? partOfFile(showing.path, [showing.said], showing.line)
          : Option.none<string>()

  /**
   * A drag, started on a four-pixel strip and finished wherever it likes.
   *
   * Pointer capture rather than listeners on the document: the pointer leaves
   * the strip on the first move of any drag worth making, and a drag that stops
   * when the pointer leaves the thing that started it is a drag nobody can
   * finish.
   */
  const dragging =
    (onMove: (at: PointerEvent) => void) =>
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const strip = event.currentTarget
      strip.setPointerCapture(event.pointerId)
      strip.onpointermove = onMove
      strip.onpointerup = () => {
        strip.releasePointerCapture(event.pointerId)
        strip.onpointermove = null
        strip.onpointerup = null
      }
    }

  /** The split between the code and the list, kept for the next name. */
  const dragSash = dragging((at) => {
    const box = body.current?.getBoundingClientRect()
    if (box === undefined) return
    const wide = Math.min(Math.max(at.clientX - box.left, LEAST.preview), box.width - LEAST.listed)
    LAYOUT.ratio = wide / box.width
    setRatio(LAYOUT.ratio)
  })

  /** How much of the file this covers, which is a question this cannot see. */
  const dragEdge = dragging((at) => {
    const box = body.current?.getBoundingClientRect()
    if (box === undefined) return
    LAYOUT.tall = Math.min(Math.max(at.clientY - box.top, SHORTEST), TALLEST)
    setTall(LAYOUT.tall)
  })

  useEffect(() => {
    const loading = Effect.runFork(load.pipe(Effect.match({ onSuccess: setEngine, onFailure: onward })))
    return () => loading.interruptUnsafe()
  }, [load])

  /*
   * The preview, drawn by the renderer rather than printed as text.
   *
   * There is no second renderer for code here and there should not be one — the
   * one this extension ships knows the reader's theme, their font, their
   * colours and how a line number is drawn, and seventeen lines printed beside
   * a file it drew would agree with none of it. A run of lines is a patch of
   * all context, so that is what it is handed. See `src/domain/wholeFile.ts`,
   * which makes the same argument one size up.
   *
   * Then the name itself is marked, by hand, in the row that was drawn. The
   * renderer's own `mark` cannot: it marks the Name it last reported, which is
   * the one under the pointer in the file above, and this is a different
   * element in a different drawing. Walking the spans to find the column is
   * three lines and does not ask the renderer for anything it does not offer.
   */
  /*
   * The values the drawing depends on, rather than the objects carrying them.
   *
   * `patch` and `showing` are built fresh on every render, so an effect keyed on
   * them redrew the preview every time anything in the panel changed — the uses
   * arriving, the repository answering, the pointer moving down the list. Three
   * or four destroys and rebuilds per opening, each one throwing away the
   * element a reader might be pointing at: a token pressed a moment after the
   * panel opened was pressed on a drawing that no longer existed, which is why
   * following a name inside the preview did nothing.
   */
  const source = Option.getOrNull(patch)
  const onLine = showing?.line
  const onColumn = showing?.from
  const onPath = showing?.path

  useEffect(() => {
    const container = shownIn.current
    if (engine === null || container === null || source === null || showing === undefined) return

    /** The file the preview is of, which is what a name followed in it is asked of. */
    const of = { path: showing.path, text: textOf(showing.path) ?? showing.said ?? "" }
    const live = engine.renderDiff(container, {
      patch: source,
      path: showing.path,
      theme: painted.scheme,
      pack: painted.pack,
      /*
       * Unified, whatever the reader chose: there is no before and after in a run
       * of lines, only the lines the pull request added among them. Those are
       * marked by a bar and not filled, so the line the name is on stays the one
       * line with a tint.
       */
      choices: { ...choices, layout: "unified", fill: false, marks: "bars" },
      notes: [],
      /*
       * Names in the preview are followable, which is the whole of the call
       * tree. The preview is a real drawing by the real renderer, so it reports
       * tokens like any other — it only ever needed somewhere to report them.
       *
       * Asked of the file this preview is of, which is the file being read or
       * one the list read whole for its lines.
       */
      onNameEnter: (name, held) => {
        if (!held.go) return
        live.mark(name, "sure")
      },
      onNameLeave: () => live.mark(null),
      onName: (name, held) => {
        if (!held.go || held.shift) return
        Effect.runFork(
          ledger.writingAt(of, { row: name.line - 1, column: name.from }).pipe(
            Effect.map((found) => {
              if (Option.isNone(found) || found.value.at !== "here") return
              // The name already being looked at is not a step: pressing it
              // would add a row saying the reader is where they are.
              const to = found.value.writing
              if (to.line === step.writing.line && to.from === step.writing.from && of.path === writtenIn) return
              setTrail((walked) => [...walked, of.path === reading.path ? { writing: to } : { writing: to, where: of.path }])
              setPicked(0)
            }),
            Effect.catch(onward)
          )
        )
      }
    })

    /*
     * Nothing is sealed in here any more, and that is the point of the move.
     *
     * While this was a row hung under a line, it was slotted into the drawing
     * above it — so every press and every pointer move inside the preview went
     * on up through that drawing's own `<pre>`, where the file's renderer was
     * listening. It heard a press in here as a press on one of its own lines:
     * on a pull request it marked that line and opened the composer on it, and
     * it carried the gutter's plus to whatever line it last saw, which over
     * this preview was one of the preview's. Three events had to be stopped by
     * hand to hold it back, and stopping them was also what stopped a name in
     * the preview from being followed.
     *
     * A popup is in `document.body`, under nothing. There is no drawing above
     * it to hear anything, so there is nothing to stop.
     */

    const marking = requestAnimationFrame(() => {
      /*
       * The separator the renderer draws above a hunk that does not start at
       * line one, taken away.
       *
       * It reads "119 unmodified lines" and it is an offer to see them. This
       * preview is seventeen lines handed over as a whole file and there is
       * nothing behind it to reveal, so the offer cannot be kept — and an offer
       * this interface cannot keep is the thing it takes most care not to make.
       * The same argument as the gutter's plus in `engine.ts`, one panel down.
       */
      for (const row of drawnIn(container)?.querySelectorAll("div") ?? []) {
        if (!(row instanceof HTMLElement)) continue
        // Exactly the separator and nothing containing it: the first try
        // matched any box whose text mentioned those words, which included the
        // one holding the gutter, and the preview lost its line numbers.
        if (/^\d+ unmodified lines?$/.test((row.textContent ?? "").trim())) {
          row.style.display = "none"
        }
      }

      const row = drawnIn(container)?.querySelector(`[data-line="${showing.line}"]`)
      if (!(row instanceof HTMLElement)) return
      // The line the row is about, tinted the way a picked line is everywhere else.
      row.style.backgroundColor = "var(--color-accent-muted)"
      if (showing.from === undefined) return

      let at = 1
      for (const span of row.querySelectorAll("span")) {
        if (span.childElementCount > 0) continue
        const wide = (span.textContent ?? "").length
        if (at <= showing.from && showing.from < at + wide) {
          span.style.backgroundColor = "color-mix(in srgb, currentColor 22%, transparent)"
          span.style.borderRadius = "2px"
          break
        }
        at += wide
      }
    })

    return () => {
      cancelAnimationFrame(marking)
      live.destroy()
    }
    // `showing` is read inside and not depended on: the line and the column are
    // what the drawing and the mark are made of, and they are depended on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, source, onLine, onColumn, onPath, painted.scheme, painted.pack, choices])

  const goTo = (row: Hit): void => {
    if (row.path !== reading.path) {
      onOpen?.(row.path, row.line)
      onClose()
      return
    }
    // Closed only where the scroll landed. A use on a line the diff folded away
    // has no row to scroll to, and closing the panel then took away the one
    // thing still showing it — the preview, which reads the whole file and is
    // already on that row, since a row is hovered before it is pressed.
    if (onGo(row.line)) onClose()
  }

  /*
   * Above the word unless there is no room, and then below it.
   *
   * Measured against the viewport rather than the pane, for the reason
   * `FollowCard` gives: the pane scrolls, the viewport is what a reader can
   * see, and a popup off the top of it is a popup that is not there. Clamped on
   * the left too, because a name near the right edge would otherwise open most
   * of this off the side of the window.
   */
  const above = at.top > ROOM
  const wide = Math.min(WIDE, window.innerWidth - 16)
  const placed: CSSProperties = {
    width: wide,
    left: Math.max(8, Math.min(at.left, window.innerWidth - wide - 8)),
    ...(above
      ? { bottom: window.innerHeight - at.top + CLEAR }
      : { top: at.bottom + CLEAR })
  }

  return createPortal(
    <div
      ref={frame}
      aria-label={`Uses of ${step.writing.name}`}
      // `FLOAT` is the named style for something standing over the page, and it
      // brings the corner, the absence of a line and the shadow with it. The
      // `border-y` this used to carry was a row's: a row is a band across the
      // file and wants an edge top and bottom, and a popup wants neither.
      className={`fixed z-50 overflow-hidden text-ink ${FLOAT}`}
      style={placed}
    >
      {/* The head: what was asked about, how many answers there are, and which to show. */}
      <div className="flex items-center gap-2 px-3 py-2">
        <h2 className="m-0 flex min-w-0 shrink-0 items-baseline gap-1 text-sm font-semibold">
          {/*
            The way back, named. A trail of one is the name itself and needs no
            chevron; past that every step before this one is pressable, because
            a reader who walked down four names wants the second, not the first.
          */}
          {[{ writing, where }, ...trail].map((was, deep) => (
            <span key={`${was.where ?? ""}:${was.writing.line}`} className="flex min-w-0 items-baseline gap-1">
              {deep === 0 ? null : <span className="text-ink-muted">›</span>}
              {deep === trail.length ? (
                <code className="truncate font-mono">{was.writing.name}</code>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTrail((walked) => walked.slice(0, deep))
                    setPicked(0)
                  }}
                  className="truncate rounded border-0 bg-transparent px-0.5 font-mono font-normal text-ink-muted hover:bg-hover hover:text-ink"
                >
                  {was.writing.name}
                </button>
              )}
            </span>
          ))}
        </h2>
        {/* Truncated rather than wrapped: the head is one line, and a count
            that pushes the popup taller has spent a line of the answer on
            saying how long the answer is. */}
        <span className="min-w-0 truncate text-xs text-ink-muted">
          {waiting ? (
            /*
             * A turning circle rather than a sentence.
             *
             * There is nothing to stream here — the repository is read once
             * and every Use arrives together — so the honest state while it
             * reads is that nothing is known yet, and the shortest way to say
             * that is not a sentence.
             */
            <SpinnerIcon size={12} aria-label="Reading the repository" />
          ) : (
            summary(listed_.uses, listed_.hidden, added) +
            (elsewhere?.ready === false ? " · the repository could not be read" : "")
          )}
        </span>
        {/*
          The two kinds of use a reader most often wants out of the way: the lines
          that only bring the name in, and the ones in tests. Remembered, because a
          reader who wants them gone wants it on the next name as well.
        */}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {(
            [
              { label: "Imports", on: shown.imports, count: listed_.imports, knob: "usesImports" },
              { label: "Tests", on: shown.tests, count: listed_.tests, knob: "usesTests" }
            ] as const
          ).map((box) => (
            <label
              key={box.knob}
              className={`flex items-center gap-1.5 text-xs text-ink-muted ${
                box.count === 0 ? "opacity-50" : "cursor-pointer hover:text-ink"
              }`}
            >
              <input
                type="checkbox"
                checked={box.on}
                disabled={box.count === 0}
                onChange={(event) => {
                  const next = event.currentTarget.checked ? "on" : "off"
                  change((current) => ({ ...current, diff: { ...current.diff, [box.knob]: next } }))
                  setPicked(0)
                }}
                className="m-0 h-3.5 w-3.5 appearance-auto accent-[var(--color-accent-emphasis)]"
              />
              {box.label}
              <span className="font-mono tabular-nums">{box.count}</span>
            </label>
          ))}
        </span>
      </div>

      {/*
        The body, split the way an editor splits it: the code on the left, the
        list on the right. The code is the answer and the list is the way through
        it, so the code has most of the width.
      */}
      <div className="flex" ref={body} style={{ height: tall }}>
        <div
          className="flex min-w-[10.5rem] shrink-0 flex-col bg-canvas"
          style={{ width: `${ratio * 100}%` }}
        >
          {showing === undefined ? null : (
            <div className="flex min-w-0 items-center gap-1 px-3 py-1.5">
              <FileMark path={showing.path} icons={settings.tree.icons} />
              <span className="shrink-0 font-mono text-xs text-ink-muted">:{showing.line}</span>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            {Option.isSome(patch) ? (
              /*
               * The renderer paints its own background, so it is told which one —
               * the same note as `WholeFile`. The preview sits on the canvas, so the
               * code reads as the page's and the list beside it as the panel's.
               */
              <div ref={shownIn} style={{ [PAPER]: "var(--color-canvas)" } as CSSProperties} />
            ) : showing !== undefined && shownText === null ? (
              <p className="m-0 px-3 py-2 text-xs text-ink-muted">This file could not be read.</p>
            ) : rows.length > 0 || waiting ? (
              <div role="status" aria-label="Reading the code" className="flex flex-col gap-2.5 px-3 py-2">
                {WAITING.map((wide, at) => (
                  <Waiting key={at} wide={wide} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* The sash. Four pixels wide, the whole height of the body, and it
            lights up under the pointer so a reader can find it without being
            told it is there. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="How wide the code is"
          onPointerDown={dragSash}
          className="w-1 shrink-0 cursor-col-resize hover:bg-accent"
        />
        <ul
          // `list-none` by name, which is how a component that wants no markers
          // asks for it here: `primer.css` resets the indent and deliberately
          // leaves `list-style` alone, because several lists in this interface
          // do want theirs. This one is rows to press, not prose.
          className="m-0 min-w-[7rem] flex-1 list-none overflow-y-auto p-0 py-1"
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
            if (step === 0) return
            // Theirs and not the page's: an arrow key inside a list of results
            // is the list's, and the file behind it scrolling as well would
            // take the row out from under the reader.
            event.preventDefault()
            event.stopPropagation()
            const next = Math.min(Math.max(picked + step, 0), rows.length - 1)
            setPicked(next)
            listed.current[next]?.focus()
          }}
        >
          {/*
            Nothing, said rather than drawn as an empty box — and only once it is
            known. While the answer is on its way the list holds the shape of
            rows instead, because "nothing" said a moment before the uses arrive
            is an answer, and the wrong one.
          */}
          {rows.length > 0 ? null : waiting ? (
            WAITING.slice(0, 3).map((wide, at) => (
              <li key={at} className="px-3 py-1.5">
                <Waiting wide={wide} />
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-ink-muted">
              {listed_.hidden > 0 ? "every use is held back by the boxes above" : "nothing else means this name"}
            </li>
          )}
          {listed_.groups.map((group) => (
            <UsesGroup
              key={group.path}
              group={group}
              tag={
                group.path === reading.path
                  ? "this file"
                  : !allChanged && changes?.paths.has(group.path) === true
                    ? "in this PR"
                    : undefined
              }
              text={textOf(group.path)}
              icons={settings.tree.icons}
              row={(hit) => {
                const index = rows.indexOf(hit)
                return {
                  picked: index === picked,
                  ref: (node) => {
                    listed.current[index] = node
                  },
                  onPick: () => setPicked(index),
                  onGo: () => goTo(hit)
                }
              }}
            />
          ))}
        </ul>
      </div>

      {/* The bottom edge, for a reader who wants more of the file or less of
          this. Eighteen lines is a guess about a question this cannot see. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="How tall this is"
        onPointerDown={dragEdge}
        className="h-1 cursor-row-resize hover:bg-accent"
      />
    </div>,
    /*
     * Beside the page rather than inside it, and marked as ours.
     *
     * `document.body` was right while the interface stood in their document
     * and is not now. The gate hides every child of `body` that is not the
     * host and does not carry the outside mark — `gateCss.ts` says exactly
     * that — so a panel portalled to a bare `body` opened, held its answer,
     * and was drawn at no size at all. Measured on a live pull request: the
     * name underlines, the press lands, `[aria-label^="Uses of "]` is in the
     * document, and its rectangle is `0×0`. Which to a reader is a click that
     * did nothing, and is the fault this was reported as.
     *
     * `outsideHost` is where the hover cards, the settings dialog, the toasts
     * and the menus already go: a child of `body` carrying the mark, so the
     * gate spares it, and carrying the theme tokens, so it is painted.
     */
    outsideHost(document, OVER_ID)
  )
}
