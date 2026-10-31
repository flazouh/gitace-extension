import { type ReactNode, useCallback, useSyncExternalStore } from "react"
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

/** The element the bar draws for the slot. */
export const BarTools = () => {
  const keep = useCallback((element: HTMLDivElement | null) => offer(element), [])

  return <div ref={keep} data-bar-tools="" className="d-tools" />
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
