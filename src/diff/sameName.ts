import type { Name } from "../ports/Renderer"

/**
 * Whether a Name is the one an element was reported for.
 *
 * The engine marks the element it was last handed and no other, so a Name from
 * somewhere else — a stale one, or one the pane worked out for itself — has to be
 * told apart from the one under the pointer. Three fields rather than identity,
 * because the pane may rebuild the object before handing it back.
 *
 * Its own module because the interface asks it too, and the interface must not
 * import the engine: that is the renderer and every grammar it carries, which the
 * interface fetches as a file of its own.
 */
export const sameName = (one: Name, two: Name): boolean =>
  one.line === two.line && one.from === two.from && one.side === two.side
