/**
 * The store's images, one frame each, photographed by `scripts/store-assets.ts` (`bun run assets`).
 *
 * Ace's light look: paper, ink and one word on clay, with one moment of the product in a
 * browser on the right. The screens are the stage's own pictures, light, drawn at the size each
 * window wants so the screen lays itself out whole, as it would in a narrower browser, and read
 * from `site/public/shots/<view>-<width>x<height>@2x.png`. `window.__shots` tells the script
 * which to take. A window shows its crop's full width and never leaves its frame.
 */
import type { ReactNode } from "react"
import { mount } from "./mount"
import { AceLockup } from "./AceLockup"
import { Mark } from "@/ui/Mark"
import "./store.css"

/** A stage view drawn at a size of the sheet's choosing, with the element it is about, if one. */
type Shot = { readonly view: string; readonly width: number; readonly height: number; readonly focus?: string }

/** A region of a shot, in its CSS pixels, from `x` across `width`: the window shows all of that width. */
type Crop = { readonly shot: Shot; readonly x: number; readonly y: number; readonly width: number }

const fileOf = (shot: Shot) => `${shot.view}-${shot.width}x${shot.height}`

/** Where each shot's focus stood when it was taken, in the shot's pixels, from `scripts/store-assets.ts`. */
const MARKS: Record<string, { x: number; y: number; width: number; height: number }> = await fetch(
  "/shots/marks.json"
)
  .then((answer) => (answer.ok ? answer.json() : {}))
  .catch(() => ({}))

/** Where a point of a crop's screen lands in a frame, the window at `left`, `top` showing it `zoom` large. */
type Place = { readonly left: number; readonly top: number; readonly zoom: number }

const Tile = ({ size, radius }: { readonly size: number; readonly radius: number }) => (
  <div className="tile" style={{ width: size, height: size, borderRadius: radius }}>
    <Mark size={size * 0.62} color="#fff" />
  </div>
)

const Lockup = ({ height }: { readonly height: number }) => (
  <div className="lockup">
    <AceLockup height={height} />
    <span className="for" style={{ fontSize: height * 0.62 }}>
      for GitHub
    </span>
  </div>
)

/** The browser's toolbar, above the screen. */
const BAR = 46

type Box = { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

const zoomOf = (at: Box, crop: Crop) => at.width / crop.width

const placeOf = (at: Box, crop: Crop): Place => ({
  left: at.left - crop.x * zoomOf(at, crop),
  top: at.top + BAR - crop.y * zoomOf(at, crop),
  zoom: zoomOf(at, crop)
})

const Window = ({
  at,
  url,
  crop
}: {
  readonly at: Box
  readonly url: ReactNode
  readonly crop: Crop
}) => (
  <div className="window" style={at}>
    <div className="top">
      <div className="dots">
        <i />
        <i />
        <i />
      </div>
      <div className="url">{url}</div>
      <div className="ours">
        <Tile size={20} radius={5} />
      </div>
    </div>
    <div className="screen" style={{ height: at.height - BAR }}>
      <img
        src={`/shots/${fileOf(crop.shot)}@2x.png`}
        alt=""
        style={{
          width: crop.shot.width * zoomOf(at, crop),
          left: -crop.x * zoomOf(at, crop),
          top: -crop.y * zoomOf(at, crop)
        }}
      />
    </div>
  </div>
)

const Address = ({ path }: { readonly path: string }) => (
  <>
    <b>github.com</b>
    <span>{path}</span>
  </>
)

type Picture = {
  readonly name: string
  readonly say: ReactNode
  readonly sub: string
  readonly path: string
  readonly crop: Crop
  /** Something laid over the screen, given where the screen's points land. */
  readonly over?: (place: Place) => ReactNode
}

const PEEK_SHOT: Shot = { view: "pull-request-peek", width: 1280, height: 800, focus: "[data-gitace-peek]" }

/** The peek ringed where it stood, and the pointer on the line above it, the name it came from. */
const Peeked = ({ left, top, zoom }: Place) => {
  const peek = MARKS[fileOf(PEEK_SHOT)]
  if (peek === undefined) return null
  return (
    <>
      <div
        className="ring"
        style={{
          left: left + (peek.x - 6) * zoom,
          top: top + (peek.y - 6) * zoom,
          width: (peek.width + 12) * zoom,
          height: (peek.height + 12) * zoom
        }}
      />
      <svg
        className="pointer"
        style={{ left: left + (peek.x + 232) * zoom, top: top + (peek.y - 24) * zoom }}
        width="26"
        height="30"
        viewBox="0 0 26 30"
        aria-hidden="true"
      >
        <path d="M3 2v22l6-5.5 4.2 9.3 4-1.8-4.2-9.2H21L3 2Z" fill="#0b0a09" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </>
  )
}

/** The five screenshots, in the order the listing shows them. */
const PICTURES: ReadonlyArray<Picture> = [
  {
    name: "working-set",
    say: (
      <>
        Every pull request that <mark>needs you</mark>.
      </>
    ),
    sub: "Across your repositories, sorted by who acts next: you, someone else, or CI.",
    path: "/pulls",
    crop: { shot: { view: "working-set", width: 960, height: 740 }, x: 0, y: 0, width: 960 }
  },
  {
    name: "pull-request",
    say: (
      <>
        One pull request, <mark>one screen</mark>.
      </>
    ),
    sub: "Failing checks, open threads and the commits since you last looked, beside the diff.",
    path: "/oven-sh/bun/pull/22841",
    crop: { shot: { view: "pull-request", width: 1000, height: 820 }, x: 0, y: 0, width: 1000 }
  },
  {
    name: "pull-request-peek",
    say: (
      <>
        Go to any <mark>definition</mark>.
      </>
    ),
    sub: "Hold ⌘ over a name in a diff. Click to read where it is written, or what uses it.",
    path: "/oven-sh/bun/pull/22841/changes",
    crop: { shot: PEEK_SHOT, x: 456, y: 50, width: 822 },
    over: (place) => <Peeked {...place} />
  },
  {
    name: "commit",
    say: (
      <>
        Every move has <mark>a key</mark>.
      </>
    ),
    sub: "Next file, previous file, seen, the next commit. ⌘K reaches any file, name or page.",
    path: "/facebook/react/commit/b1f6d4a",
    crop: { shot: { view: "commit", width: 900, height: 740 }, x: 0, y: 0, width: 900 }
  },
  {
    name: "run",
    say: (
      <>
        Checks that say <mark>why</mark>.
      </>
    ),
    sub: "A failed run opens on the test that failed, with each warning and where it came from.",
    path: "/oven-sh/bun/actions/runs/18742",
    crop: { shot: { view: "run", width: 900, height: 740 }, x: 0, y: 0, width: 900 }
  }
]

const Frame = ({
  name,
  width,
  height,
  children
}: {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly children: ReactNode
}) => (
  <figure>
    <figcaption>
      {name} · {width}×{height}
    </figcaption>
    <div data-asset={name} className="card" style={{ width, height }}>
      {children}
    </div>
  </figure>
)

const SCREENSHOT_WINDOW: Box = { left: 492, top: 80, width: 736, height: 640 }

const Screenshot = ({ picture }: { readonly picture: Picture }) => (
  <Frame name={picture.name} width={1280} height={800}>
    <div style={{ position: "absolute", left: 72, top: 64 }}>
      <Lockup height={24} />
    </div>
    <div className="words" style={{ left: 72, top: 0, bottom: 0, width: 380, justifyContent: "center", gap: 26 }}>
      <p className="say" style={{ fontSize: 56 }}>
        {picture.say}
      </p>
      <p className="sub" style={{ fontSize: 20, lineHeight: 1.45, maxWidth: 370 }}>
        {picture.sub}
      </p>
    </div>
    <Window at={SCREENSHOT_WINDOW} url={<Address path={picture.path} />} crop={picture.crop} />
    {picture.over?.(placeOf(SCREENSHOT_WINDOW, picture.crop))}
  </Frame>
)

/** The four groups every list files by, with the mock Working Set's own counts. */
const GROUPS: ReadonlyArray<readonly [string, number]> = [
  ["Needs you", 10],
  ["Waiting", 3],
  ["Running", 3],
  ["Settled", 6]
]

const BANNER_CROP: Crop = { shot: { view: "working-set", width: 960, height: 740 }, x: 0, y: 0, width: 960 }

const Banner = ({
  name,
  width,
  height,
  window
}: {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly window: number
}) => (
  <Frame name={name} width={width} height={height}>
    <div
      className="words"
      style={{ left: 72, top: 0, bottom: 0, width: width - window - 160, justifyContent: "center", gap: 28 }}
    >
      <Lockup height={26} />
      <p className="say" style={{ fontSize: width > 1300 ? 60 : 50 }}>
        GitHub, sorted by <mark>who acts next</mark>.
      </p>
      <p className="sub" style={{ fontSize: 20, lineHeight: 1.45, maxWidth: width - window - 200 }}>
        Review pull requests, go to any definition, and keep CI in view, on github.com.
      </p>
    </div>
    <Window
      at={{ left: width - window - 56, top: 56, width: window, height: height - 112 }}
      url={<Address path="/pulls" />}
      crop={BANNER_CROP}
    />
  </Frame>
)

const SHOTS: ReadonlyArray<Shot> = [...PICTURES.map((picture) => picture.crop.shot), BANNER_CROP.shot]

Object.assign(window, { __shots: SHOTS.map((shot) => ({ ...shot, file: fileOf(shot) })) })

mount(
  "sheet",
  <div className="sheet">
    <figure>
      <figcaption>icon-128 · 128×128 · transparent, 96 drawn</figcaption>
      <div data-asset="icon-128" style={{ width: 128, height: 128, display: "grid", placeItems: "center" }}>
        <Tile size={96} radius={21} />
      </div>
    </figure>
    {PICTURES.map((picture) => (
      <Screenshot key={picture.name} picture={picture} />
    ))}
    <Frame name="promo-tile" width={440} height={280}>
      <div className="words" style={{ left: 30, top: 0, bottom: 0, width: 380, justifyContent: "center", gap: 18 }}>
        <Lockup height={17} />
        <p className="say" style={{ fontSize: 40 }}>
          GitHub, sorted by <mark>who acts next</mark>.
        </p>
        <div className="groups">
          {GROUPS.map(([group, count]) => (
            <span key={group}>
              {group} <b>{count}</b>
            </span>
          ))}
        </div>
      </div>
    </Frame>
    <Banner name="marquee" width={1400} height={560} window={720} />
    <Banner name="social-card" width={1200} height={630} window={600} />
  </div>
)
