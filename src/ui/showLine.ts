import type { Bounds } from "../ports/Renderer"

/**
 * Puts one line of a drawn diff on the screen, and says whether it found it.
 *
 * The diff is drawn into a shadow root by a renderer that is not ours, so the
 * row is found by the attribute that renderer writes on every line it draws —
 * `data-line`, which is the line's own number and not its index. Its own module
 * rather than a helper inside the pane, so the one assumption this interface
 * makes about somebody else's markup is a file with its name on it — and so the
 * half that is ours can be tested without the renderer, which is a built
 * artefact no test here has.
 *
 * A miss is an answer rather than a throw. A line named in an address may be
 * past the end of a file that has since changed, or inside a hunk this diff does
 * not show, and neither is a reason to do anything but leave the reader at the
 * top of the file they asked for.
 */
export const showLine = (host: ParentNode | null, line: number): boolean => {
  // The new side's row: a removed line drew the same number from the old file.
  const rows = [...(drawnIn(host)?.querySelectorAll(`[data-line="${line}"]`) ?? [])]
  const row = rows.find((one) => one.getAttribute("data-line-type") !== "change-deletion") ?? rows[0]
  if (!(row instanceof HTMLElement)) return false

  // A line already on the screen stays where it is, and the reader with it.
  if (onScreen(row)) return true

  /*
   * Instant, and said so rather than left to be inherited.
   *
   * GitHub sets `scroll-behavior: smooth` on the document, so a scroll that does
   * not say otherwise animates — and an animation that never runs is a scroll
   * that never lands. Measured on a live page: the same call arrives at 2041 as
   * `instant` and at 0 without it, which is a press that does nothing at all.
   *
   * It is also the right answer whatever the page says. Following a name is
   * arriving somewhere, not travelling there, and two thousand pixels of
   * travel is two thousand pixels of a reader's file they did not ask to see.
   */
  row.scrollIntoView({ block: "center", behavior: "instant" })
  return true
}

/**
 * Whether a drawn row is wholly inside the window and the pane that scrolls it.
 * A row with no size has not been laid out, and is not.
 */
const onScreen = (row: HTMLElement): boolean => {
  const box = row.getBoundingClientRect()
  if (box.height <= 0 || box.top < 0 || box.bottom > window.innerHeight) return false
  const pane = scrollerOf(row)?.getBoundingClientRect()
  return pane === undefined || (box.top >= pane.top && box.bottom <= pane.bottom)
}

/** The nearest element that scrolls a row, across the shadow root it was drawn in. */
const scrollerOf = (row: Element): Element | null => {
  for (let at: Node | null = row.parentNode; at !== null; ) {
    if (at instanceof ShadowRoot) {
      at = at.host
      continue
    }
    if (at instanceof Element && at.scrollHeight > at.clientHeight && /auto|scroll/u.test(getComputedStyle(at).overflowY)) {
      return at
    }
    at = at.parentNode
  }
  return null
}

/**
 * Where a line of a drawn diff is on the screen, for something to be put beside it.
 *
 * The answer behind `boundsOf`, which is the renderer's and is better: it knows
 * the token, and a card beside the word is closer than a card beside the line.
 * But it answers only about the token it last reported entering, and a press
 * lets go of that token on the way down — so a panel that opens on a press
 * needs somewhere to be when the renderer has already forgotten. A line is
 * still drawn, and `data-line` is the same attribute `showLine` above trusts.
 */
export const lineBounds = (host: ParentNode | null, line: number): Bounds | null => {
  const row = drawnIn(host)?.querySelector(`[data-line="${line}"]`) ?? null
  if (!(row instanceof HTMLElement)) return null

  const box = row.getBoundingClientRect()
  return { top: box.top, left: box.left, bottom: box.bottom, right: box.right }
}

/**
 * The root the renderer actually drew into, given the element it was handed.
 *
 * Not the same element. `renderDiff` makes a `<diffs-container>`, attaches the
 * shadow root to *that*, and puts it inside the container it was given — so the
 * element a pane holds a ref to has no shadow root at all, and every caller
 * that reached for `host.shadowRoot` was reaching for null.
 *
 * Which is what it did. A press on a name scrolled nowhere, a file named in a
 * failing log opened at the top instead of at its line, and neither said
 * anything: `showLine` answers false for a line it cannot find, and a line it
 * cannot find looks exactly like a root that was never there.
 */
export const drawnIn = (host: ParentNode | null): ParentNode | null => {
  if (host === null) return null
  if (host instanceof Element && host.shadowRoot !== null) return host.shadowRoot

  const drawn = host.querySelector("diffs-container")
  return drawn?.shadowRoot ?? host
}

/** Long enough for the draw the line is inside of, in milliseconds. */
export const DRAWING = 2_000
