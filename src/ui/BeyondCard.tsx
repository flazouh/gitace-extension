import { createPortal } from "react-dom"
import type { Beyond } from "../ports/Ledger"
import { FLOAT } from "./dress"
import { OVER_ID, outsideHost } from "./outside"
import type { Bounds } from "../ports/Renderer"

/**
 * A name that lives in another repository, and the way to it.
 *
 * `import { one } from "@yourorg/thing"` is not a path, and what it names is not
 * in the archive this repository was read from. It is in another repository,
 * which this extension already draws — so following it is going to a page, and
 * the page is one of ours.
 *
 * A card rather than a jump, because leaving the repository is a larger thing
 * than scrolling and should be a press rather than a consequence. It says where
 * it is going before it goes.
 */
export type BeyondCardProps = {
  readonly beyond: Beyond
  readonly at: Bounds
  readonly onGo: (address: string) => void
  readonly onClose: () => void
}

const CLEAR = 8

/** The address of one line of one file of one repository, which GitHub's own is. */
export const addressOf = (beyond: Beyond): string | null => {
  if (beyond.owner === undefined || beyond.repo === undefined || beyond.path === undefined) {
    return null
  }
  return `https://github.com/${beyond.owner}/${beyond.repo}/blob/${beyond.ref ?? "HEAD"}/${beyond.path}#L${beyond.line ?? 1}`
}

export const BeyondCard = ({ beyond, at, onGo, onClose }: BeyondCardProps) => {
  const above = at.top > 200
  if (beyond.docs !== undefined) return documented(beyond, beyond.docs, at, above, onClose)

  const address = addressOf(beyond)
  if (address === null) return null

  return createPortal(
    <div
      className={`${FLOAT} fixed z-50 max-w-[32rem] overflow-hidden text-ink`}
      style={{
        left: Math.max(8, Math.min(at.left, window.innerWidth - 520)),
        ...(above ? { bottom: window.innerHeight - at.top + CLEAR } : { top: at.bottom + CLEAR })
      }}
    >
      <button
        type="button"
        onClick={() => {
          onGo(address)
          onClose()
        }}
        className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-hover"
      >
        {beyond.signature === undefined || beyond.signature === "" ? null : (
          <code className="block truncate font-mono text-xs">{beyond.signature}</code>
        )}
        <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-muted">
          <span className="font-mono">
            {beyond.here === true
              ? `${beyond.path}:${beyond.line}`
              : `${beyond.owner}/${beyond.repo} · ${beyond.path}:${beyond.line}`}
          </span>
          {/*
            Another repository is a name matched in an index rather than a name
            proved, and a reader about to leave one repository for another should
            be told which they are getting. See `docs/spec/following.md`.
          */}
          <span className="text-busy">Likely</span>
        </span>
      </button>
    </div>,
    outsideHost(document, OVER_ID)
  )
}

/**
 * A name no repository here holds, and where it is documented.
 *
 * In a tab of its own: the documentation is not a page of this review, and the
 * review should still be there when the reader is done with it.
 */
const documented = (beyond: Beyond, docs: string, at: Bounds, above: boolean, onClose: () => void) =>
  createPortal(
    <div
      className={`${FLOAT} fixed z-50 max-w-[32rem] overflow-hidden text-ink`}
      style={{
        left: Math.max(8, Math.min(at.left, window.innerWidth - 520)),
        ...(above ? { bottom: window.innerHeight - at.top + CLEAR } : { top: at.bottom + CLEAR })
      }}
    >
      <a
        href={docs}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-hover"
      >
        <code className="font-mono">{beyond.name}</code>
        <span className="text-ink-muted">
          {beyond.crate === undefined ? "Not in this repository · search Rust's docs" : `${beyond.crate} · docs`}
        </span>
      </a>
    </div>,
    outsideHost(document, OVER_ID)
  )
