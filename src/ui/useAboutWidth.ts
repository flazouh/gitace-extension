import { useEffect, useRef, useState } from "react"
import { held, remPixels } from "./columns"

/**
 * Where the line between a pull request page's two parts stands.
 *
 * The width the reader chose comes in, and goes out through `keep` once the handle has stopped. While it is being
 * moved the page follows it from here, so the settings are written once per move and not once per pixel. The row
 * the two parts stand in is measured, so that a window narrower than the width the reader chose still leaves the
 * files panel its least; a row that has no width (hidden, or not drawn yet) is not measured at all, and the
 * width stands as it was chosen.
 */
export const useAboutWidth = (chosen: number, keep: (rem: number) => void) => {
  const row = useRef<HTMLDivElement>(null)
  const [rowRem, setRowRem] = useState<number | undefined>(undefined)
  const [moving, setMoving] = useState<number | undefined>(undefined)

  useEffect(() => {
    const box = row.current
    if (box === null || typeof ResizeObserver === "undefined") return
    const watch = new ResizeObserver(() => {
      const width = box.getBoundingClientRect().width
      setRowRem(width > 0 ? width / remPixels() : undefined)
    })
    watch.observe(box)
    return () => watch.disconnect()
  }, [])

  return {
    row,
    rowRem,
    width: held(moving ?? chosen, rowRem),
    onChange: setMoving,
    onRest: (rem: number) => {
      keep(rem)
      setMoving(undefined)
    }
  }
}
