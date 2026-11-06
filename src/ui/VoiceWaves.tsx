import { useEffect, useRef } from "react"
import { bar, drifted, smoothed } from "./voiceBars"

/** As many bars as Ace's recording pill stands, 16 high. */
const BARS = 9
const HIGH = 16
const LOWEST = 3

const stillness = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * The bars, moving with the voice.
 *
 * Painted by a frame loop straight onto the bars' styles rather than through React: the level
 * changes sixty times a second and nothing else on the page needs to hear about it. With
 * Reduce Motion they hold still at the size of the voice.
 */
export const VoiceWaves = ({ level }: { readonly level: () => number }) => {
  const row = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const bars = Array.from(row.current?.querySelectorAll("i") ?? [])
    const still = stillness()
    let shown = 0
    let phase = 0
    let then = performance.now()
    let frame = 0

    const paint = (now: number) => {
      const seconds = Math.min(0.1, (now - then) / 1000)
      then = now
      shown = still ? level() : smoothed(shown, level(), seconds)
      if (!still) phase = drifted(phase, shown, seconds)
      bars.forEach((one, index) => {
        const tall = bar((index + 0.5) / BARS, shown, phase)
        one.style.height = `${Math.max(LOWEST, tall * HIGH)}px`
        one.style.opacity = String(0.4 + 0.6 * tall)
      })
      if (!still) frame = requestAnimationFrame(paint)
    }

    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [level])

  return (
    <span ref={row} className="t-mic-waves" aria-hidden="true">
      {Array.from({ length: BARS }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  )
}
