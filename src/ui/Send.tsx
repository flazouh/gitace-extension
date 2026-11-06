import type { ReactNode } from "react"
import { useArt } from "./art"

/**
 * The button that sends a writing box, as Ace's composer's Send: the word, then the arrow in a
 * chip at its right. It stands in the box, at the foot of the row of controls.
 */
export const Send = ({
  onSend,
  disabled,
  busy,
  children
}: {
  readonly onSend: () => void
  readonly disabled: boolean
  readonly busy?: boolean
  /** The word: Comment, Answer, Reply. */
  readonly children: ReactNode
}) => {
  const art = useArt()
  return (
    <button
      type="button"
      className="t-go"
      disabled={disabled}
      aria-busy={busy === true ? true : undefined}
      onClick={onSend}
    >
      {children}
      <span className="t-go-chip" aria-hidden="true">
        <art.send size={16} />
      </span>
    </button>
  )
}
