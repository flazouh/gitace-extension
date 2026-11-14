/**
 * The store's images, one frame each, photographed by `scripts/store-assets.ts` (`bun run assets`).
 *
 * Ace's light look: paper, ink and one word on clay, with one moment of the product in a
 * browser on the right. The screens are the stage's own pictures (`bun run shots`, light),
 * read from `site/public/shots/<view>@2x.png` and cropped here to the part a picture is
 * about, so each one reads at the size the store shows it.
 */
import type { ReactNode } from "react"
import { mount } from "./mount"
import { AceLockup } from "./AceLockup"
import { Mark } from "@/ui/Mark"
import "./store.css"

/** A region of a stage view, in that view's own CSS pixels, and how large it is drawn. */
type Crop = { readonly view: string; readonly width: number; readonly x: number; readonly y: number; readonly zoom: number }

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

const Window = ({
  at,
  url,
  crop
}: {
  readonly at: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
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
    <div className="screen" style={{ height: at.height - 46 }}>
      <img
        src={`/shots/${crop.view}@2x.png`}
        alt=""
        style={{ width: crop.width * crop.zoom, left: -crop.x * crop.zoom, top: -crop.y * crop.zoom }}
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
  /** Something laid over the window, as a card the screen would show. */
  readonly over?: ReactNode
}

/** The keys the commit screen walks with, the defaults of `src/keys/commands.ts`. */
const KEYS: ReadonlyArray<readonly [string, string]> = [
  ["s", "Next file"],
  ["w", "Previous file"],
  ["x", "Mark it seen"],
  ["]", "Older commit"],
  ["t", "Go to a file"]
]

const KeysCard = () => (
  <div className="keys" style={{ left: 516, top: 440 }}>
    {KEYS.map(([key, says]) => (
      <div key={key} className="row">
        <kbd>{key}</kbd>
        <span>{says}</span>
      </div>
    ))}
  </div>
)

/** Where the peek stands in the cropped screen, ringed, and the pointer on the name it came from. */
const Peeked = () => (
  <>
    <div className="ring" style={{ left: 612, top: 418, width: 700, height: 196 }} />
    <svg className="pointer" style={{ left: 846, top: 412 }} width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
      <path d="M3 2v22l6-5.5 4.2 9.3 4-1.8-4.2-9.2H21L3 2Z" fill="#0b0a09" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  </>
)

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
    crop: { view: "home", width: 1440, x: 304, y: 30, zoom: 1.05 }
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
    crop: { view: "pull-request", width: 1280, x: 22, y: 30, zoom: 1.12 }
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
    crop: { view: "pull-request-peek", width: 1280, x: 700, y: 236, zoom: 1.2 },
    over: <Peeked />
  },
  {
    name: "commit",
    say: (
      <>
        Every move has <mark>a key</mark>.
      </>
    ),
    sub: "Next file, previous file, seen. ⌘K reaches any file, name or page.",
    path: "/facebook/react/commit/b1f6d4a",
    crop: { view: "commit", width: 1280, x: 300, y: 196, zoom: 1.08 },
    over: <KeysCard />
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
    crop: { view: "run", width: 1280, x: 26, y: 34, zoom: 1.12 }
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

const Screenshot = ({ picture }: { readonly picture: Picture }) => (
  <Frame name={picture.name} width={1280} height={800}>
    <div style={{ position: "absolute", left: 72, top: 64 }}>
      <Lockup height={24} />
    </div>
    <div className="words" style={{ left: 72, top: 0, bottom: 0, width: 470, justifyContent: "center", gap: 28 }}>
      <p className="say" style={{ fontSize: 68 }}>
        {picture.say}
      </p>
      <p className="sub" style={{ fontSize: 22, lineHeight: 1.42, maxWidth: 430 }}>
        {picture.sub}
      </p>
    </div>
    <Window
      at={{ left: 590, top: 96, width: 780, height: 780 }}
      url={<Address path={picture.path} />}
      crop={picture.crop}
    />
    {picture.over}
  </Frame>
)

/** The four groups every list files by, with the mock Working Set's own counts. */
const GROUPS: ReadonlyArray<readonly [string, number]> = [
  ["Needs you", 10],
  ["Waiting", 3],
  ["Running", 3],
  ["Settled", 6]
]

const HOME_CROP: Crop = { view: "home", width: 1440, x: 304, y: 30, zoom: 1.05 }

const Banner = ({ name, width, height }: { readonly name: string; readonly width: number; readonly height: number }) => (
  <Frame name={name} width={width} height={height}>
    <div
      className="words"
      style={{ left: 80, top: 0, bottom: 0, width: width - 760, justifyContent: "center", gap: 30 }}
    >
      <Lockup height={26} />
      <p className="say" style={{ fontSize: width > 1300 ? 64 : 54 }}>
        GitHub, sorted by <mark>who acts next</mark>.
      </p>
      <p className="sub" style={{ fontSize: 22, lineHeight: 1.42, maxWidth: 520 }}>
        Review pull requests, go to any definition, and keep CI in view, on github.com.
      </p>
    </div>
    <Window
      at={{ left: width - 640, top: 70, width: 700, height: height }}
      url={<Address path="/pulls" />}
      crop={HOME_CROP}
    />
  </Frame>
)

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
    <Banner name="marquee" width={1400} height={560} />
    <Banner name="social-card" width={1200} height={630} />
  </div>
)
