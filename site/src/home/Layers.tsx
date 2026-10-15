import { MiniInbox } from "./MiniInbox"

const LAYERS = [
  { name: "Page", says: "Pull requests, code, issues and runs, redrawn" },
  { name: "Your session", says: "The GitHub sign-in you already have" },
  { name: "GitHub", says: "github.com, read as you would read it" }
] as const

/**
 * How it reads GitHub, as three plates: the page it draws, the session it reads with,
 * and github.com under both. Held still, where Ace's own pins and scrolls.
 */
export const Layers = () => (
  <section id="session" className="ace-layers">
    <div className="ace-pin-row">
      <div className="ace-scene" aria-hidden>
        <div className="ace-plane ace-top">
          <MiniInbox />
        </div>
        <div className="ace-plane ace-session" />
        <div className="ace-plane ace-github" />
      </div>

      <ul className="ace-legend">
        {LAYERS.map((layer) => (
          <li key={layer.name}>
            <b>{layer.name}</b>
            <span>{layer.says}</span>
          </li>
        ))}
      </ul>
    </div>

    <p className="ace-caption">Three layers. No server in between.</p>
  </section>
)
