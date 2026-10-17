import { INK, MARK } from "./bed"

/*
 * The mark and the wordmark, drawn by the site and by the app's first screen.
 *
 * The mark is Ace's own (`crates/ui/assets/ace-mark.svg` in flazouh/ace), unchanged: GitAce Extension is
 * Ace's git part, and its colour is what tells the two apart. Ace draws it in ink; this draws it in purple.
 * The viewBox is square, with the 120 x 82 mark centred in it, so a size is a size whatever the shape.
 *
 * Shared for the reason the gradient is: they are the two things a reader has just
 * seen on gitace.dev, and a logo that is nearly the same is worse than one that is
 * plainly different. The icon geometry the build script rasterises into `.icns` is
 * still its own copy — that one runs without React — and it says so in its own file.
 */

/** Ace's mark as one path, in its own 120 x 82 box. */
export const MARK_PATH =
  "M43.7 81.4H0L85.7 0H120v81.4H76.9L61.6 64.7 43.7 81.4Zm29.2-32.2h24.4V24.6L72.9 49.2Z"

export const Mark = ({
  size = 128,
  color = MARK
}: {
  readonly size?: number
  readonly color?: string
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 -19 120 120"
    fill={color}
    aria-hidden="true"
    role="presentation"
  >
    <path d={MARK_PATH} />
  </svg>
)

export const Wordmark = ({
  size = 32,
  color = INK
}: {
  readonly size?: number
  readonly color?: string
}) => (
  <span
    style={{
      fontSize: size,
      fontWeight: 620,
      letterSpacing: "-0.035em",
      color,
      lineHeight: 1
    }}
  >
    GitAce Extension
  </span>
)
