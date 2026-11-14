import { MARK } from "./bed"

/*
 * Ace's mark (`crates/ui/assets/ace-mark.svg` in Ace), unchanged: this is Ace in the browser.
 * The viewBox is square, with the 120 x 82 mark centred in it, so a size is a size whatever the shape.
 * `scripts/build-icons.ts` and `wayBack.ts` hold the same geometry for places without React.
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
