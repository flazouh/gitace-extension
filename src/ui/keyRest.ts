/**
 * The row the keyboard stands on, once it has stood there long enough to be read ahead.
 *
 * The keyboard's half of what `ui/lingering.ts` is for the pointer. A list that walks
 * with the arrows marks the row it is on `data-chosen`, and Enter opens that row: so the
 * chosen row is where the press will be, as plainly as a pointer resting on a link. A
 * held arrow passes over every row on its way, so a row is only worth reading once the
 * keyboard has stopped on it for the dwell its page asks for.
 *
 * Watched through the attribute rather than told by the list, so no list has to know
 * the read-ahead exists, and the rules the pointer follows (one read at a time, the
 * visit's share, nothing while a press is on its way) stay with the one caller that
 * owns them.
 */

import type { Stop } from "./navigation"

/** The link of the row the keyboard is on. */
const CHOSEN_LINK = "[data-chosen] a[href]"

/**
 * Calls `rested` with the chosen row's link once the keyboard has stayed on it for
 * `dwell(link)` milliseconds. `dwell` answers `null` for a link not worth reading, and
 * is asked when the keyboard arrives, so a link read meanwhile is not counted twice.
 */
export const whenTheKeyRests = (
  root: Node,
  dwell: (link: HTMLAnchorElement) => number | null,
  rested: (link: HTMLAnchorElement) => void
): Stop => {
  let on: HTMLAnchorElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const look = (): void => {
    const found =
      root instanceof Element || root instanceof Document
        ? root.querySelector<HTMLAnchorElement>(CHOSEN_LINK)
        : null
    if (found === on) return

    on = found
    clearTimeout(timer)
    timer = undefined
    if (found === null) return

    const wait = dwell(found)
    if (wait === null) return
    timer = setTimeout(() => {
      timer = undefined
      if (on === found) rested(found)
    }, wait)
  }

  const watch = new MutationObserver(look)
  watch.observe(root, { subtree: true, attributes: true, attributeFilter: ["data-chosen"] })

  return () => {
    watch.disconnect()
    clearTimeout(timer)
    on = null
  }
}
