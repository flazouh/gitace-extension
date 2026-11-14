/**
 * How an organisation's single sign-on is put to a reader, wherever it is put.
 *
 * There are two places, and they are two components for a real reason: one is a
 * card inside our own working interface reporting a 401 from their API, which has
 * no token and nothing to post, so it can only send the reader to GitHub's own
 * page for it. The other stands on the wall itself, where their form and its token
 * are in the document and the button really does answer it.
 *
 * Different things to offer, then, but one thing to say — and the sentence was
 * written out three times, drifting in the tail each time. The words live here and
 * the offer arrives as children, so what actually differs between the two is what
 * you see at each call site: one passes a link, the other a button and a tick.
 */
import { Owner } from "./Owner"

export type SignOnAskProps = {
  readonly organisation: string
  /** What is being kept from the reader, named as their page names it. */
  readonly what: string
  /** How the sentence ends, which is the one part that is not shared. */
  readonly then: string
  readonly children: React.ReactNode
}

export const SignOnAsk = ({ organisation, what, then, children }: SignOnAskProps) => (
  <>
    <div className="mb-2 flex items-center gap-3">
      <Owner owner={organisation} size={28} />
      <h2 className="min-w-0 truncate text-base font-semibold text-ink">Sign on to {organisation}</h2>
    </div>
    <p className="mb-4 text-sm leading-5 text-ink-muted">
      GitHub shows <span className="break-all text-ink">{what}</span> once you have signed on. {then}
    </p>
    {children}
  </>
)
