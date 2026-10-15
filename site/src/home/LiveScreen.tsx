import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import type { HeroLiveScene } from "../HeroStage"
import { Skeleton } from "./Skeleton"

const HeroStage = lazy(() => import("../HeroStage"))

/**
 * One of the extension's own screens, running from fixtures inside a frame.
 *
 * Not a picture of the product: `HeroStage` mounts the real interface over a mock
 * repository. Until it has painted, the frame shows the code-drawn `Skeleton`.
 *
 * The screen is decoration on this page, so it is `inert`: a keyboard never tabs into
 * a pretend pull request, and a screen reader hears the one sentence in `label`
 * instead of the mock's every row. A screen below the fold mounts when the reader is
 * about a screen away from it, so the page's first paint loads one screen and not two.
 */
export const LiveScreen = ({
  scene,
  label,
  eager = false
}: {
  readonly scene: HeroLiveScene
  readonly label: string
  readonly eager?: boolean
}) => {
  const frame = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(eager)
  const [ready, setReady] = useState(false)
  const painted = useCallback(() => setReady(true), [])

  useEffect(() => {
    if (near) return
    const at = frame.current
    if (at === null) return

    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          watch.disconnect()
        }
      },
      { rootMargin: "900px 0px" }
    )
    watch.observe(at)
    return () => watch.disconnect()
  }, [near])

  return (
    <div ref={frame} role="img" aria-label={label} className="ace-live">
      <div className={`ace-live-under${ready ? " gone" : ""}`}>
        <Skeleton />
      </div>
      <div inert className="ace-live-screen">
        {near ? (
          <Suspense fallback={null}>
            <HeroStage scene={scene} onReady={painted} />
          </Suspense>
        ) : null}
      </div>
    </div>
  )
}
