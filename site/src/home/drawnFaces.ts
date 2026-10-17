import { faceDataUri } from "../../../shots/mock/faces"

/**
 * Turn the avatars a live screen asks github.com for into faces drawn in code.
 *
 * The fixtures already draw their people locally (`shots/mock/faces.ts` says why: a
 * fixture's handle can belong to a real person). The interface's own row and owner
 * icons still name `https://github.com/<login>.png`, which would put pictures fetched
 * from GitHub on a page that loads none. Each one is swapped, as it appears, for the
 * same initial on a colour that the fixture faces use.
 */
const FROM_GITHUB = /^https:\/\/github\.com\/([^/?#]+)\.png(?:\?|$)/

const redraw = (image: HTMLImageElement): void => {
  const login = FROM_GITHUB.exec(image.getAttribute("src") ?? "")?.[1]
  if (login === undefined) return
  image.removeAttribute("srcset")
  image.setAttribute("src", faceDataUri(decodeURIComponent(login)))
}

const redrawUnder = (root: ParentNode): void => {
  for (const image of root.querySelectorAll("img")) redraw(image)
}

/** Watches `root` until the returned function is called. */
export const drawFacesIn = (root: HTMLElement): (() => void) => {
  redrawUnder(root)
  const watch = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "attributes" && change.target instanceof HTMLImageElement) redraw(change.target)
      for (const added of change.addedNodes) {
        if (added instanceof HTMLImageElement) redraw(added)
        else if (added instanceof Element) redrawUnder(added)
      }
    }
  })
  watch.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] })
  return () => watch.disconnect()
}
