/**
 * The history entries this extension made, marked so the page's own router leaves them alone.
 *
 * GitHub's newer pages run a router that keeps its own record in `history.state`. A Back
 * or a Forward onto an entry it did not make finds no record there, and it answers by
 * loading the whole address again, as its own form of it: Back from an issue to the list
 * this extension drew loaded `/owner/repo/issues/`, slash added, and threw away every
 * screen the document held.
 *
 * `history.state` is theirs to write, so the mark goes in the Navigation API's state for
 * the entry instead, which is a separate slot. It is shared between this extension's world
 * and the page's, which is how the guard in the page's world reads what this one wrote.
 *
 * No imports: the page-world script bundles this, and nothing else of ours belongs there.
 */

const MARK = "gitace"

type Entries = {
  readonly currentEntry?: { readonly getState: () => unknown } | null
  readonly updateCurrentEntry?: (options: { readonly state: unknown }) => void
}

const entriesOf = (view: Window): Entries | undefined => (view as Window & { readonly navigation?: Entries }).navigation

/** Whether an entry's Navigation API state is the mark this extension leaves. */
export const isOurEntry = (state: unknown): boolean =>
  typeof state === "object" && state !== null && (state as Record<string, unknown>)[MARK] === true

const markCurrent = (view: Window): void => {
  entriesOf(view)?.updateCurrentEntry?.({ state: { [MARK]: true } })
}

/** A new entry for an address this extension draws itself. */
export const pushOurEntry = (view: Window, address: string): void => {
  view.history.pushState(null, "", address)
  markCurrent(view)
}

/** The same entry under another address, still ours if it was. */
export const replaceKeepingOurs = (view: Window, address: string): void => {
  const ours = isOurEntry(entriesOf(view)?.currentEntry?.getState())
  view.history.replaceState(view.history.state, "", address)
  if (ours) markCurrent(view)
}
