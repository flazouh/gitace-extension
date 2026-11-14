/**
 * Something on or off, as a track and a knob.
 *
 * The control only; what it is called is the call site's, by `label` when nothing on screen
 * names it or by `labelledBy` when a sentence beside it does.
 */
export const Switch = ({
  on,
  onFlip,
  label,
  labelledBy
}: {
  readonly on: boolean
  readonly onFlip: (next: boolean) => void
  readonly label?: string
  readonly labelledBy?: string
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    aria-labelledby={labelledBy}
    onClick={() => onFlip(!on)}
    className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
      on ? "bg-accent-emphasis" : "bg-line"
    }`}
  >
    <span className={`size-3 rounded-full bg-raised transition-transform ${on ? "translate-x-3" : ""}`} />
  </button>
)
