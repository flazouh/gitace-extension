import { markOwnedRoute, OWNED_ROUTE } from "./navigationGuard"
import { ourTree } from "../ui/theHost"

const WATCHING: MutationObserverInit = { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] }

/** Protects added links without walking GitHub's hidden page on each update. */
export const protectOwnedLinks = (
  target: Document,
  owns: (link: HTMLAnchorElement) => boolean
): (() => void) => {
  let roots: readonly HTMLElement[] = []
  // The interface lives in a shadow root, and an observer of the document never hears what
  // changes inside one. Watched as well, and again whenever a new host stands one up.
  let watched: ShadowRoot | null = null
  const protect = (link: HTMLAnchorElement) => {
    if (link.hasAttribute("href") && owns(link)) markOwnedRoute(link)
    else link.removeAttribute(OWNED_ROUTE)
  }
  const update = (changes: readonly MutationRecord[]) => {
    const tree = ourTree(target)
    if (tree !== null && tree !== watched) {
      observer.observe(tree, WATCHING)
      watched = tree
    }
    const ours = tree ?? target
    const current = [
      ours.querySelector<HTMLElement>("#gitace-root"),
      ours.querySelector<HTMLElement>("#gitace-bar")
    ]
      .filter((root) => root !== null)
    const added = new Set<Element>(current.filter((root) => !roots.includes(root)))
    roots = current
    for (const change of changes) {
      if (!roots.some((root) => root.contains(change.target))) continue
      if (change.type === "attributes" && change.target instanceof HTMLAnchorElement)
        added.add(change.target)
      for (const node of change.addedNodes) {
        if (node instanceof Element && roots.some((root) => root.contains(node))) added.add(node)
      }
    }
    for (const node of added) {
      // Nested additions share a traversal, even if records arrive out of order.
      let parent = node.parentElement
      while (parent !== null && !added.has(parent)) parent = parent.parentElement
      if (parent !== null) continue
      if (node instanceof HTMLAnchorElement) protect(node)
      for (const link of node.querySelectorAll<HTMLAnchorElement>("a[href]")) protect(link)
    }
  }
  const observer = new MutationObserver(update)
  observer.observe(target.documentElement, WATCHING)
  update([])
  return () => { observer.disconnect(); roots = []; watched = null }
}
