import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react"
import { ABOUT_WIDTH_LEAST, DEFAULT_ABOUT_WIDTH } from "../domain/Settings"
import { asked, held, remPixels, widest, widthAt } from "./columns"

/**
 * The handle between the two parts of a pull request's page, which moves the line between them.
 *
 * It stands in the gap, as wide as the gap, and finds the row it moves the line in by `row`. It keeps no width
 * of its own: the page tells it the width it has and it says the width it is asked for, `onChange` as the line
 * moves and `onRest` once it has stopped, so the settings are written once and not on every pixel of a drag.
 *
 * Pointer capture rather than listeners on the document, for the reason the sash in `UsesPanel` gives: the
 * pointer leaves a four-pixel strip on the first move of any drag worth making.
 *
 * Reachable from the keyboard as a separator is: Tab to it, then the arrows (Shift for larger steps), Home and
 * End for the ends of its travel, Enter to put it back. A double press does the same. Every key it answers is
 * kept from the page's own keys, which would otherwise read an arrow as a move between files.
 */
export const ColumnHandle = ({
  width,
  row,
  rowRem,
  onChange,
  onRest
}: {
  /** How wide the left part is now, in rem. */
  readonly width: number
  /** The row the two parts stand in, for where its left edge is. */
  readonly row: RefObject<HTMLElement | null>
  /** How wide that row is in rem, once it has been measured. */
  readonly rowRem?: number | undefined
  /** The line is moving: the width it has now. */
  readonly onChange: (rem: number) => void
  /** The line has stopped: the width to keep. */
  readonly onRest: (rem: number) => void
}) => {
  const [dragging, setDragging] = useState(false)
  // The last width asked for, which `pointerup` has no other way to learn: the state it would read is the one
  // the handler was made with.
  const latest = useRef(width)
  latest.current = width

  const move = (rem: number) => {
    const next = held(rem, rowRem)
    latest.current = next
    onChange(next)
  }

  const start = (event: PointerEvent<HTMLDivElement>) => {
    const box = row.current?.getBoundingClientRect()
    if (box === undefined || event.button !== 0) return
    const strip = event.currentTarget
    const rem = remPixels()
    strip.setPointerCapture?.(event.pointerId)
    setDragging(true)
    strip.onpointermove = (at) => move(widthAt(at.clientX, box.left, rem))
    strip.onpointerup = () => {
      strip.releasePointerCapture?.(event.pointerId)
      strip.onpointermove = null
      strip.onpointerup = null
      setDragging(false)
      onRest(latest.current)
    }
  }

  const press = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = asked(event.key, event.shiftKey, width, rowRem)
    if (next === undefined) return
    event.preventDefault()
    event.stopPropagation()
    latest.current = next
    onChange(next)
    onRest(next)
  }

  const reset = () => {
    const next = held(DEFAULT_ABOUT_WIDTH, rowRem)
    latest.current = next
    onChange(next)
    onRest(next)
  }

  const most = rowRem === undefined ? undefined : widest(rowRem)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="How wide the conversation is"
      aria-valuemin={ABOUT_WIDTH_LEAST}
      aria-valuemax={most}
      aria-valuenow={width}
      tabIndex={0}
      data-dragging={dragging ? "" : undefined}
      onPointerDown={start}
      onKeyDown={press}
      onDoubleClick={reset}
      title="Drag to resize. Double-click to reset."
      className="group relative -mx-1 w-[calc(0.375rem+0.5rem)] shrink-0 cursor-col-resize touch-none select-none self-stretch outline-none"
    >
      {/* Pinned the way the files panel is, so the handle is under the pointer for as long as the panel is. */}
      <div className="sticky top-[calc(var(--gitace-bar-h,0px)+0.5rem)] flex h-[calc(100vh-var(--gitace-bar-h,0px)-1rem)] min-h-[40rem] justify-center">
        <div className="h-full w-0.5 rounded-full bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent group-data-[dragging]:bg-accent" />
      </div>
    </div>
  )
}
