import { type ReactNode, useLayoutEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { useScreenActivity } from "./screenActivity"

/**
 * The bar's tool slot: the place in the header where a screen's own controls stand.
 *
 * The bar and the screen are two elements on the page, so a screen cannot simply render its
 * filter row into the header. The bar names one element as the slot while it is drawn, and a
 * screen's `IntoTheBar` portals into it. Where no bar is drawn (a test, a list on its own) the
 * controls stay where the screen put them.
 */
let slot: HTMLElement | null = null
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const current = () => slot

const offer = (element: HTMLElement | null) => {
  if (slot === element) return
  slot = element
  for (const listener of listeners) listener()
}

/**
 * The element the bar draws for the slot, offered only while the bar has room for what is in it.
 *
 * A bar too narrow for a screen's controls takes the slot back, and the controls stand in place
 * as the list's first row: on a repository's pull requests at 1440 pixels the bar needed 1333 of
 * its 1251 and the page scrolled sideways. The slot is offered again once the bar is as wide as
 * it was found to need, not as soon as the empty slot fits, which would put the row back into a
 * bar it had just overflowed.
 */
export const BarTools = () => {
  const [element, setElement] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const bar = element?.parentElement
    if (element === null || bar == null) return
    offer(element)
    if (typeof ResizeObserver === "undefined") return () => offer(null)

    let needed = 0
    const weigh = () => {
      if (slot === element) {
        if (bar.scrollWidth <= bar.clientWidth + 1) return
        needed = bar.scrollWidth
        offer(null)
      } else if (bar.clientWidth >= needed) offer(element)
    }
    const watch = new ResizeObserver(weigh)
    watch.observe(bar)
    watch.observe(element)
    return () => {
      watch.disconnect()
      offer(null)
    }
  }, [element])

  return <div ref={setElement} data-bar-tools="" className="d-tools" />
}

/**
 * A screen's controls, standing in the bar when there is one and in place otherwise.
 *
 * Nothing at all from a screen kept behind the one showing: there is one slot, and a kept
 * Home put its filter row into the bar of the repository page in front of it.
 */
export const IntoTheBar = ({ children }: { readonly children: ReactNode }) => {
  const into = useSyncExternalStore(subscribe, current, () => null)
  const active = useScreenActivity()

  if (!active) return null
  return into === null ? <>{children}</> : createPortal(children, into)
}
