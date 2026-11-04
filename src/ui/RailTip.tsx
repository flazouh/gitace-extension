import * as Tip from "@radix-ui/react-tooltip"
import type { ReactElement, ReactNode } from "react"
import { FLOAT } from "./dress"
import { OVER_ID, outsideHost } from "./outside"

/**
 * The rail's names, said beside the glyph.
 *
 * They were `title` attributes, which is the browser's tooltip: a second before it shows, under the
 * pointer and over the page, and a second again on the next glyph down. A rail is read by running
 * the pointer along it, so the first name waits a beat and every name after it is there at once.
 */
export const RailTips = ({ children }: { readonly children: ReactNode }) => (
  <Tip.Provider delayDuration={200} skipDelayDuration={400}>
    {children}
  </Tip.Provider>
)

/** One glyph's name, and the keys that do the same, to its right. */
export const RailTip = ({
  name,
  keys,
  children
}: {
  readonly name: string
  readonly keys?: string
  readonly children: ReactElement
}) => (
  <Tip.Root>
    <Tip.Trigger asChild>{children}</Tip.Trigger>
    {/* Into our host rather than the end of the document, where the theme's tokens do not reach. */}
    <Tip.Portal container={outsideHost(document, OVER_ID)}>
      <Tip.Content
        side="right"
        sideOffset={8}
        collisionPadding={8}
        className={`t-tip z-50 flex items-center gap-2 px-2 py-1 text-xs text-ink ${FLOAT}`}
      >
        {name}
        {keys === undefined ? null : <kbd className="font-mono text-ink-muted"> {keys}</kbd>}
      </Tip.Content>
    </Tip.Portal>
  </Tip.Root>
)
