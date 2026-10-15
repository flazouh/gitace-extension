import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Lockup } from "./Lockup"
import { inShort, useStars } from "./stars"
import { STORES, theirStore, type Store } from "./stores"

/**
 * What every page of the site shares: the bar, the nav, the install button and the
 * footer, in the Ace family's look (`ace.css`).
 *
 * GitAce Extension is one of Ace's products, so the bar on top of every page says so and
 * links to the Ace app, and the footer carries the GitAce lockup pressed into the paper
 * the way useace.dev carries Ace's.
 */

export const SOURCE_AT = "https://github.com/flazouh/gitace-extension"

export const ACE_AT = "https://useace.dev"

/** Inner column for the simple pages (jobs, compare, welcome). */
export const HELD = "mx-auto w-full max-w-6xl px-6"

/** The reader's store, read once: a browser does not change under a page. */
export const useTheirStore = (): Store => {
  const [store] = useState(theirStore)
  return store
}

/**
 * The install button, pointed at the store for the reader's browser.
 *
 * Cream on the dark hero and band, ink on paper, as Ace's download button is.
 */
export const Install = ({ tone = "ink" }: { readonly tone?: "cream" | "ink" }) => {
  const store = useTheirStore()
  return (
    <a className={`ace-btn ${tone === "cream" ? "ace-btn-cream" : "ace-btn-ink"}`} href={store.at}>
      {store.press}
    </a>
  )
}

export const Quietly = ({ at, children }: { readonly at: string; readonly children: ReactNode }) => {
  const away = at.startsWith("http")

  return (
    <a
      className="underline decoration-current/30 underline-offset-2 transition-opacity duration-[var(--duration-press)] ease-out hover:decoration-current/70"
      href={at}
      target={away ? "_blank" : undefined}
      rel={away ? "noreferrer" : undefined}
    >
      {children}
    </a>
  )
}

export const SkipTo = ({ id, says }: { readonly id: string; readonly says: string }) => (
  <a
    href={`#${id}`}
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:bg-[var(--ink)] focus:px-4 focus:py-2 focus:text-[var(--paper)]"
  >
    {says}
  </a>
)

const Star = () => (
  <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
  </svg>
)

/** "GitHub", and the star count beside it once GitHub has answered. */
const Source = () => {
  const many = useStars()

  return (
    <a
      href={SOURCE_AT}
      className="ace-stars"
      aria-label={
        many === undefined
          ? "GitAce Extension on GitHub"
          : `GitAce Extension on GitHub, ${many} ${many === 1 ? "star" : "stars"}`
      }
    >
      GitHub
      {many === undefined ? null : (
        <span className="live-in ace-stars">
          <Star />
          {inShort(many)}
        </span>
      )}
    </a>
  )
}

/**
 * Whether the nav is still over the dark hero.
 *
 * Over it the nav is cream on night, as Ace's is; once the hero's bottom passes under
 * the nav it turns to ink on paper, because cream on paper is unreadable.
 */
const useOverNight = (heroId: string | undefined): boolean => {
  const [over, setOver] = useState(heroId !== undefined)

  useEffect(() => {
    if (heroId === undefined) return
    const hero = document.getElementById(heroId)
    if (hero === null) return

    let frame = 0
    const look = () => {
      frame = 0
      setOver(hero.getBoundingClientRect().bottom > 60)
    }
    const heard = () => {
      if (frame === 0) frame = window.requestAnimationFrame(look)
    }

    look()
    window.addEventListener("scroll", heard, { passive: true })
    window.addEventListener("resize", heard)
    return () => {
      window.removeEventListener("scroll", heard)
      window.removeEventListener("resize", heard)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [heroId])

  return over
}

/**
 * The bar and the nav, on top of every page.
 *
 * `over` names the dark hero the nav starts out on; the pages without one leave it out
 * and get the paper nav from the first frame.
 */
export const Masthead = ({ over }: { readonly over?: string }) => {
  const night = useOverNight(over)
  const store = useTheirStore()

  return (
    <>
      <div className="ace-bar ace-up">
        <a href={ACE_AT}>GitAce Extension is part of Ace: meet the Ace app</a>
      </div>

      <header className={`ace-nav ace-up${night ? " night" : ""}`}>
        <nav className="ace-l" aria-label="On this page">
          <a href="/#inbox">Inbox</a>
          <a href="/#session">Session</a>
          <a href="/#pages">Pages</a>
        </nav>

        <a className="ace-word" href="/" aria-label="GitAce Extension home">
          <Lockup decorative />
        </a>

        <div className="ace-r">
          <Source />
          <a className="ace-install" href={store.at}>
            Install
          </a>
        </div>
      </header>
    </>
  )
}

/** The top of a simple page: its eyebrow, headline and button, on paper. */
export const Above = ({ children }: { readonly children: ReactNode }) => (
  <header className="ace">
    <div className={HELD}>{children}</div>
  </header>
)

export const Footer = () => (
  <footer className="ace-foot">
    <nav className="ace-links ace-up" aria-label="Elsewhere">
      <a href={SOURCE_AT}>GitHub</a>
      <a href={STORES.chrome.at}>{STORES.chrome.name}</a>
      <a href={STORES.firefox.at}>{STORES.firefox.name}</a>
      <a href={STORES.safari.at}>{STORES.safari.name}</a>
      <a href={ACE_AT}>Ace</a>
    </nav>

    {/* The nav's lockup already links home; this one is the paper's, and only says the name. */}
    <div className="ace-deboss">
      <Lockup decorative />
    </div>

    <div className="ace-copy">
      <span>© Ace 2026 · Not affiliated with GitHub</span>
    </div>
  </footer>
)
